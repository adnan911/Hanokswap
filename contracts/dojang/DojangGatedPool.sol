// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./DojangAttestationHook.sol";
import "../libraries/TransientReentrancyGuard.sol";

interface IERC20Minimal {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title DojangGatedPool
/// @notice Institutional / KYC-gated Liquidity Pool on Giwa Chain requiring Dunamu Dojang Attestation.
contract DojangGatedPool is TransientReentrancyGuard {
    DojangAttestationHook public immutable hook;
    address public immutable token0;
    address public immutable token1;
    uint24 public immutable fee; // base fee in hundredths of a bip (e.g. 3000 = 0.3%)

    uint256 public reserve0;
    uint256 public reserve1;

    error KYCVerificationRequired();
    error ZeroLiquidity();
    error SlippageExceeded();

    event GatedSwap(address indexed sender, address tokenIn, uint256 amountIn, uint256 amountOut, uint256 feePaid);
    event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1);

    modifier onlyKYCVerified(address user) {
        if (!hook.isKYCVerified(user) && !hook.isVIPTrader(user)) {
            revert KYCVerificationRequired();
        }
        _;
    }

    constructor(
        address _hook,
        address _token0,
        address _token1,
        uint24 _fee
    ) {
        require(_hook != address(0) && _token0 != address(0) && _token1 != address(0), "Zero address");
        require(_token0 != _token1 && _fee < 1000000, "Invalid pool parameters");
        hook = DojangAttestationHook(_hook);
        token0 = _token0;
        token1 = _token1;
        fee = _fee;
    }

    function addLiquidity(uint256 amount0, uint256 amount1) external nonReentrant onlyKYCVerified(msg.sender) returns (uint256) {
        require(amount0 > 0 && amount1 > 0, "Zero amounts");
        _pullExact(token0, amount0);
        _pullExact(token1, amount1);

        reserve0 += amount0;
        reserve1 += amount1;

        emit LiquidityAdded(msg.sender, amount0, amount1);
        return amount0;
    }

    function swap(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external nonReentrant onlyKYCVerified(msg.sender) returns (uint256 amountOut) {
        require(tokenIn == token0 || tokenIn == token1, "Invalid token");
        require(amountIn > 0, "Zero input");
        require(recipient != address(0), "Zero recipient");
        if (reserve0 == 0 || reserve1 == 0) revert ZeroLiquidity();

        bool isToken0 = tokenIn == token0;
        (uint256 resIn, uint256 resOut) = isToken0 ? (reserve0, reserve1) : (reserve1, reserve0);
        address tokenOut = isToken0 ? token1 : token0;

        // Apply dynamic fee discount from Dojang Attestation Hook
        (uint256 discountBps, ) = hook.getUserFeeDiscount(msg.sender);
        uint256 effectiveFee = fee - (fee * discountBps / 10000);

        uint256 amountInWithFee = amountIn * (1000000 - effectiveFee);
        amountOut = (amountInWithFee * resOut) / ((resIn * 1000000) + amountInWithFee);

        if (amountOut < minAmountOut) revert SlippageExceeded();

        _pullExact(tokenIn, amountIn);
        require(IERC20Minimal(tokenOut).transfer(recipient, amountOut), "Transfer failed");

        if (isToken0) {
            reserve0 += amountIn;
            reserve1 -= amountOut;
        } else {
            reserve1 += amountIn;
            reserve0 -= amountOut;
        }

        emit GatedSwap(msg.sender, tokenIn, amountIn, amountOut, effectiveFee);
    }

    function _pullExact(address token, uint256 amount) private {
        uint256 beforeBalance = IERC20Minimal(token).balanceOf(address(this));
        require(IERC20Minimal(token).transferFrom(msg.sender, address(this), amount), "TransferFrom failed");
        require(IERC20Minimal(token).balanceOf(address(this)) == beforeBalance + amount, "Unsupported token transfer fee");
    }
}
