// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../libraries/TransientReentrancyGuard.sol";

interface IERC20FX {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

/// @title KRWCStableswapPool (Korean Won Deep FX Curve)
/// @notice Optimized Curve StableSwap invariant (A = 1000) for Korean Won Stablecoin (KRWC) paired with USD/EUR stablecoins.
/// @dev Implements rate scaling (1 USD = 1,400 KRW, 1 EUR = 1,520 KRW) to ensure 1:1 normalized virtual invariant math.
contract KRWCStableswapPool is TransientReentrancyGuard {
    uint256 public constant N_COINS = 4; // 0: KRWC, 1: USDC, 2: EURC, 3: USYC
    uint256 public constant A_PRECISION = 100;
    uint256 public constant FEE_DENOMINATOR = 10**10;

    address[N_COINS] public coins;
    uint256[N_COINS] public balances;
    uint256[N_COINS] public precisionMultipliers; // converts token decimals to 18 decimals
    uint256[N_COINS] public rateScalers;          // FX rate normalized to KRW base (1 KRWC = 1e18, 1 USDC = 1400e18)

    uint256 public A; // Amplification coefficient (A = 1000)
    uint256 public fee; // Base fee (e.g., 4000000 = 0.04%)
    uint256 public adminFee = 5000000000; // 50% of swap fee to feeVault
    address public feeVault;
    address public owner;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    event TokenExchange(
        address indexed buyer,
        uint256 soldId,
        uint256 tokensSold,
        uint256 boughtId,
        uint256 tokensBought
    );
    event AddLiquidity(
        address indexed provider,
        uint256[N_COINS] amounts,
        uint256[N_COINS] fees,
        uint256 invariant,
        uint256 tokenSupply
    );
    event RemoveLiquidity(
        address indexed provider,
        uint256[N_COINS] amounts,
        uint256[N_COINS] fees,
        uint256 tokenSupply
    );
    event RateUpdated(uint256 indexed coinId, uint256 newRate);
    event RampA(uint256 oldA, uint256 newA, uint256 initialTime, uint256 futureTime);

    constructor(
        address _krwc,
        address _usdc,
        address _eurc,
        address _usyc,
        address _feeVault
    ) {
        owner = msg.sender;
        coins[0] = _krwc;
        coins[1] = _usdc;
        coins[2] = _eurc;
        coins[3] = _usyc;
        feeVault = _feeVault;

        A = 1000 * A_PRECISION; // A = 1000 for deep Korean FX curve
        fee = 4000000; // 0.04%

        // Precision multipliers to 18 decimals
        precisionMultipliers[0] = 10**(18 - _getDecimals(_krwc)); // KRWC (6 dec -> 1e12)
        precisionMultipliers[1] = 10**(18 - _getDecimals(_usdc)); // USDC (6 dec -> 1e12)
        precisionMultipliers[2] = 10**(18 - _getDecimals(_eurc)); // EURC (6 dec -> 1e12)
        precisionMultipliers[3] = 10**(18 - _getDecimals(_usyc)); // USYC (6 dec -> 1e12)

        // Initial standard FX rates normalized to KRW base:
        // 1 KRWC = 1.0 (1e18)
        // 1 USDC = 1,400.0 KRW (1400e18)
        // 1 EURC = 1,521.74 KRW (1521740000000000000000)
        // 1 USYC = 1,400.0 KRW (1400e18)
        rateScalers[0] = 1e18;
        rateScalers[1] = 1400 * 1e18;
        rateScalers[2] = 1521740000000000000000;
        rateScalers[3] = 1400 * 1e18;
    }

    function _getDecimals(address token) private view returns (uint8) {
        if (token.code.length == 0) return 6;
        (bool success, bytes memory data) = token.staticcall(abi.encodeWithSignature("decimals()"));
        if (success && data.length >= 32) {
            uint256 dec = abi.decode(data, (uint256));
            return dec <= 18 ? uint8(dec) : 18;
        }
        return 6;
    }

    /// @notice Update currency conversion rate for FX valuation
    function setRateScaler(uint256 coinId, uint256 newRate) external {
        require(msg.sender == owner, "Only owner");
        require(coinId < N_COINS, "Invalid coinId");
        require(newRate > 0, "Rate must be > 0");
        rateScalers[coinId] = newRate;
        emit RateUpdated(coinId, newRate);
    }

    /// @notice Normalized balances converted to 18-decimal KRW purchasing power parity
    function _xp() internal view returns (uint256[N_COINS] memory xp) {
        for (uint256 i = 0; i < N_COINS; i++) {
            // balance * precisionMultiplier * rateScaler / 1e18
            xp[i] = (balances[i] * precisionMultipliers[i] * rateScalers[i]) / 1e18;
        }
    }

    /// @notice Calculate D invariant for N coins
    function _get_D(uint256[N_COINS] memory xp, uint256 amp) internal pure returns (uint256) {
        uint256 S = 0;
        for (uint256 i = 0; i < N_COINS; i++) {
            S += xp[i];
        }
        if (S == 0) return 0;

        uint256 Dprev = 0;
        uint256 D = S;
        uint256 Ann = amp * N_COINS;

        for (uint256 iter = 0; iter < 255; iter++) {
            uint256 D_P = D;
            for (uint256 i = 0; i < N_COINS; i++) {
                D_P = (D_P * D) / (xp[i] * N_COINS);
            }
            Dprev = D;
            D = (Ann * S / A_PRECISION + D_P * N_COINS) * D / (((Ann - A_PRECISION) * D / A_PRECISION) + ((N_COINS + 1) * D_P));
            if (D > Dprev) {
                if (D - Dprev <= 1) return D;
            } else {
                if (Dprev - D <= 1) return D;
            }
        }
        return D;
    }

    /// @notice Calculate token out amount for token in
    function _get_y(uint256 i, uint256 j, uint256 x, uint256[N_COINS] memory xp) internal view returns (uint256) {
        uint256 amp = A;
        uint256 D = _get_D(xp, amp);
        uint256 Ann = amp * N_COINS;
        uint256 c = D;
        uint256 S_ = 0;
        uint256 _x = 0;

        for (uint256 k = 0; k < N_COINS; k++) {
            if (k == i) {
                _x = x;
            } else if (k != j) {
                _x = xp[k];
            } else {
                continue;
            }
            S_ += _x;
            c = (c * D) / (_x * N_COINS);
        }
        c = (c * D * A_PRECISION) / (Ann * N_COINS);
        uint256 b = S_ + (D * A_PRECISION) / Ann;
        uint256 y_prev = 0;
        uint256 y = D;

        for (uint256 iter = 0; iter < 255; iter++) {
            y_prev = y;
            y = (y * y + c) / (2 * y + b - D);
            if (y > y_prev) {
                if (y - y_prev <= 1) return y;
            } else {
                if (y_prev - y <= 1) return y;
            }
        }
        return y;
    }

    /// @notice Estimate output tokens for a swap
    function get_dy(uint256 i, uint256 j, uint256 dx) external view returns (uint256) {
        require(i < N_COINS && j < N_COINS && i != j, "Invalid coin index");
        uint256[N_COINS] memory xp = _xp();
        
        uint256 dx_normalized = (dx * precisionMultipliers[i] * rateScalers[i]) / 1e18;
        uint256 x = xp[i] + dx_normalized;
        uint256 y = _get_y(i, j, x, xp);
        
        uint256 dy_normalized = xp[j] - y - 1;
        uint256 _fee = (fee * dy_normalized) / FEE_DENOMINATOR;
        dy_normalized = dy_normalized - _fee;

        // Convert back from normalized KRW base to target token units
        return (dy_normalized * 1e18) / (precisionMultipliers[j] * rateScalers[j]);
    }

    /// @notice Execute exchange between KRWC and other foreign stablecoins
    function exchange(
        uint256 i,
        uint256 j,
        uint256 dx,
        uint256 min_dy,
        address recipient
    ) external nonReentrant returns (uint256) {
        require(i < N_COINS && j < N_COINS && i != j, "Invalid coin index");
        require(dx > 0, "dx must be > 0");

        uint256[N_COINS] memory xp = _xp();
        uint256 dx_normalized = (dx * precisionMultipliers[i] * rateScalers[i]) / 1e18;
        uint256 x = xp[i] + dx_normalized;
        uint256 y = _get_y(i, j, x, xp);

        uint256 dy_normalized = xp[j] - y - 1;
        uint256 dy_fee = (fee * dy_normalized) / FEE_DENOMINATOR;
        uint256 dy_admin_fee = (dy_fee * adminFee) / FEE_DENOMINATOR;

        dy_normalized = dy_normalized - dy_fee;

        uint256 dy = (dy_normalized * 1e18) / (precisionMultipliers[j] * rateScalers[j]);
        require(dy >= min_dy, "Slippage: dy < min_dy");

        // Update balances
        balances[i] += dx;
        balances[j] -= (dy + (dy_admin_fee * 1e18) / (precisionMultipliers[j] * rateScalers[j]));

        // Transfer tokens
        require(IERC20FX(coins[i]).transferFrom(msg.sender, address(this), dx), "TransferIn failed");
        require(IERC20FX(coins[j]).transfer(recipient, dy), "TransferOut failed");

        if (dy_admin_fee > 0 && feeVault != address(0)) {
            uint256 adminAmount = (dy_admin_fee * 1e18) / (precisionMultipliers[j] * rateScalers[j]);
            if (adminAmount > 0) {
                IERC20FX(coins[j]).transfer(feeVault, adminAmount);
            }
        }

        emit TokenExchange(msg.sender, i, dx, j, dy);
        return dy;
    }

    /// @notice Get virtual price of the LP token
    function get_virtual_price() external view returns (uint256) {
        uint256 D = _get_D(_xp(), A);
        if (totalSupply == 0) return 1e18;
        return (D * 1e18) / totalSupply;
    }
}
