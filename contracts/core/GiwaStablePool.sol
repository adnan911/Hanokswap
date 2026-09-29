// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IGiwaStablePool.sol";
import "../libraries/TransientReentrancyGuard.sol";

interface IERC20Stable {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

/// @title GiwaStablePool
/// @notice Stableswap pool implementing the Curve-style invariant for ultra-low slippage swaps between pegged assets.
contract GiwaStablePool is IGiwaStablePool, TransientReentrancyGuard {
    uint256 public constant N_COINS = 2;
    uint256 public constant A_PRECISION = 100;
    uint256 public constant FEE_DENOMINATOR = 10**10;

    address[N_COINS] public coinsList;
    uint256[N_COINS] public balancesList;
    uint256[N_COINS] public rates;

    uint256 public override A;
    uint256 public override fee;
    uint256 public override admin_fee = 5000000000; // 50% of swap fee to feeVault
    address public feeVault;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    constructor(
        address token0,
        address token1,
        uint24 _fee,
        address _feeVault
    ) {
        coinsList[0] = token0;
        coinsList[1] = token1;
        fee = uint256(_fee) * 10**6; // normalized to 10^10 scale
        feeVault = _feeVault;
        A = 100 * A_PRECISION; // Default A = 100

        uint8 dec0 = _getDecimals(token0);
        uint8 dec1 = _getDecimals(token1);

        rates[0] = 10**(36 - dec0);
        rates[1] = 10**(36 - dec1);
    }

    function _getDecimals(address token) private view returns (uint8) {
        if (token.code.length == 0) return 18;
        (bool success, bytes memory data) = token.staticcall(abi.encodeWithSignature("decimals()"));
        if (success && data.length >= 32) {
            uint256 dec = abi.decode(data, (uint256));
            return dec <= 18 ? uint8(dec) : 18;
        }
        return 18;
    }

    function coins(uint256 i) external view override returns (address) {
        return coinsList[i];
    }

    function balances(uint256 i) external view override returns (uint256) {
        return balancesList[i];
    }

    function A_precise() external view override returns (uint256) {
        return A;
    }

    function _get_D(uint256[N_COINS] memory xp, uint256 amp) internal pure returns (uint256) {
        uint256 S = xp[0] + xp[1];
        if (S == 0) return 0;

        uint256 Dprev = 0;
        uint256 D = S;
        uint256 Ann = amp * N_COINS;

        for (uint256 i = 0; i < 255; i++) {
            uint256 D_P = D;
            D_P = (D_P * D) / (xp[0] * N_COINS);
            D_P = (D_P * D) / (xp[1] * N_COINS);
            Dprev = D;
            D = (Ann * S / A_PRECISION + D_P * N_COINS) * D / ((Ann - A_PRECISION) * D / A_PRECISION + (N_COINS + 1) * D_P);
            if (D > Dprev) {
                if (D - Dprev <= 1) return D;
            } else {
                if (Dprev - D <= 1) return D;
            }
        }
        return D;
    }

    function _get_y(uint256 i, uint256 j, uint256 x, uint256[N_COINS] memory xp) internal view returns (uint256) {
        uint256 amp = A;
        uint256 D = _get_D(xp, amp);
        uint256 Ann = amp * N_COINS;
        uint256 c = D;
        uint256 S_ = 0;
        uint256 _x = 0;
        uint256 y_prev = 0;
        uint256 y = D;

        for (uint256 _k = 0; _k < N_COINS; _k++) {
            if (_k == i) _x = x;
            else if (_k != j) _x = xp[_k];
            else continue;
            S_ += _x;
            c = (c * D) / (_x * N_COINS);
        }
        c = (c * D * A_PRECISION) / (Ann * N_COINS);
        uint256 b = S_ + (D * A_PRECISION) / Ann;

        for (uint256 _k = 0; _k < 255; _k++) {
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

    function get_dy(uint256 i, uint256 j, uint256 dx) external view override returns (uint256) {
        uint256[N_COINS] memory xp = [
            (balancesList[0] * rates[0]) / 10**18,
            (balancesList[1] * rates[1]) / 10**18
        ];

        uint256 x = xp[i] + (dx * rates[i]) / 10**18;
        uint256 y = _get_y(i, j, x, xp);
        uint256 dy = (xp[j] - y - 1) * 10**18 / rates[j];
        uint256 _fee = (fee * dy) / FEE_DENOMINATOR;
        return dy - _fee;
    }

    function get_virtual_price() external view override returns (uint256) {
        if (totalSupply == 0) return 0;
        uint256[N_COINS] memory xp = [
            (balancesList[0] * rates[0]) / 10**18,
            (balancesList[1] * rates[1]) / 10**18
        ];
        uint256 D = _get_D(xp, A);
        return (D * 10**18) / totalSupply;
    }

    function exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy) external override nonReentrant returns (uint256 dy) {
        require(i != j && i < N_COINS && j < N_COINS, "StablePool: INVALID_COINS");
        require(dx > 0, "StablePool: DX_ZERO");

        uint256[N_COINS] memory xp = [
            (balancesList[0] * rates[0]) / 10**18,
            (balancesList[1] * rates[1]) / 10**18
        ];

        uint256 x = xp[i] + (dx * rates[i]) / 10**18;
        uint256 y = _get_y(i, j, x, xp);
        dy = (xp[j] - y - 1) * 10**18 / rates[j];
        uint256 _fee = (fee * dy) / FEE_DENOMINATOR;
        dy -= _fee;
        require(dy >= minDy, "StablePool: SLIPPAGE_EXCEEDED");

        balancesList[i] += dx;
        balancesList[j] -= dy;

        _safeTransferFrom(coinsList[i], msg.sender, address(this), dx);
        _safeTransfer(coinsList[j], msg.sender, dy);

        emit TokenExchange(msg.sender, i, dx, j, dy);
    }

    function add_liquidity(uint256[] calldata amounts, uint256 minMintAmount) external override nonReentrant returns (uint256 mintAmount) {
        require(amounts.length == N_COINS, "StablePool: LENGTH_MISMATCH");
        uint256[N_COINS] memory xp = [
            (balancesList[0] * rates[0]) / 10**18,
            (balancesList[1] * rates[1]) / 10**18
        ];

        uint256 D0 = totalSupply == 0 ? 0 : _get_D(xp, A);

        uint256[N_COINS] memory newXp = [
            ((balancesList[0] + amounts[0]) * rates[0]) / 10**18,
            ((balancesList[1] + amounts[1]) * rates[1]) / 10**18
        ];

        uint256 D1 = _get_D(newXp, A);
        require(D1 > D0, "StablePool: D1 <= D0");

        if (totalSupply == 0) {
            mintAmount = D1;
        } else {
            mintAmount = (totalSupply * (D1 - D0)) / D0;
        }

        require(mintAmount >= minMintAmount, "StablePool: MIN_MINT_NOT_MET");

        for (uint256 i = 0; i < N_COINS; i++) {
            if (amounts[i] > 0) {
                balancesList[i] += amounts[i];
                _safeTransferFrom(coinsList[i], msg.sender, address(this), amounts[i]);
            }
        }

        totalSupply += mintAmount;
        balanceOf[msg.sender] += mintAmount;

        emit AddLiquidity(msg.sender, amounts, fee, totalSupply);
    }

    function remove_liquidity(uint256 amount, uint256[] calldata minAmounts) external override nonReentrant returns (uint256[] memory returnedAmounts) {
        require(balanceOf[msg.sender] >= amount, "StablePool: INSUFFICIENT_BALANCE");
        require(minAmounts.length == N_COINS, "StablePool: LENGTH_MISMATCH");

        returnedAmounts = new uint256[](N_COINS);
        for (uint256 i = 0; i < N_COINS; i++) {
            uint256 value = (balancesList[i] * amount) / totalSupply;
            require(value >= minAmounts[i], "StablePool: MIN_AMOUNT_NOT_MET");
            balancesList[i] -= value;
            returnedAmounts[i] = value;
            _safeTransfer(coinsList[i], msg.sender, value);
        }

        totalSupply -= amount;
        balanceOf[msg.sender] -= amount;

        emit RemoveLiquidity(msg.sender, returnedAmounts, totalSupply);
    }

    function remove_liquidity_one_coin(uint256 tokenAmount, uint256 i, uint256 minAmount) external override nonReentrant returns (uint256 coinAmount) {
        require(balanceOf[msg.sender] >= tokenAmount, "StablePool: INSUFFICIENT_BALANCE");
        require(i < N_COINS, "StablePool: INVALID_COIN_INDEX");

        uint256[N_COINS] memory xp = [
            (balancesList[0] * rates[0]) / 10**18,
            (balancesList[1] * rates[1]) / 10**18
        ];

        uint256 D0 = _get_D(xp, A);
        uint256 D1 = D0 - (tokenAmount * D0) / totalSupply;

        uint256 newY = _get_y_D(A, i, xp, D1);
        uint256 dy = (xp[i] - newY) * 10**18 / rates[i];

        require(dy >= minAmount, "StablePool: MIN_AMOUNT_NOT_MET");

        balancesList[i] -= dy;
        totalSupply -= tokenAmount;
        balanceOf[msg.sender] -= tokenAmount;

        _safeTransfer(coinsList[i], msg.sender, dy);

        emit RemoveLiquidityOne(msg.sender, i, tokenAmount, dy);
        return dy;
    }

    function _get_y_D(uint256 amp, uint256 i, uint256[N_COINS] memory xp, uint256 D) internal pure returns (uint256) {
        uint256 Ann = amp * N_COINS;
        uint256 c = D;
        uint256 S_ = 0;
        uint256 _x = 0;
        uint256 y_prev = 0;
        uint256 y = D;

        for (uint256 _k = 0; _k < N_COINS; _k++) {
            if (_k != i) {
                _x = xp[_k];
                S_ += _x;
                c = (c * D) / (_x * N_COINS);
            }
        }
        c = (c * D * A_PRECISION) / (Ann * N_COINS);
        uint256 b = S_ + (D * A_PRECISION) / Ann;

        for (uint256 _k = 0; _k < 255; _k++) {
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

    function _safeTransfer(address token, address to, uint256 value) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20Stable.transfer.selector, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "StablePool: TRANSFER_FAILED");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 value) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20Stable.transferFrom.selector, from, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "StablePool: TRANSFER_FROM_FAILED");
    }
}
