// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IPermit2.sol";

/// @title IGiwaUniversalRouter
/// @notice Single entry point for routing swaps across Concentrated Liquidity (CLAMM) and Stableswap pools.
interface IGiwaUniversalRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
        bool isStable;
    }

    struct SwapHop {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        bool isStable;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactInputMultiHopParams {
        SwapHop[] hops;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    struct ExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
        bool isStable;
    }

    struct Permit2Signature {
        IPermit2.PermitTransferFrom permit;
        bytes signature;
    }

    event RouteExecuted(
        address indexed sender,
        address indexed recipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        bool isFlashblockSimulated
    );

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
    function exactInputMultiHop(ExactInputMultiHopParams calldata params) external payable returns (uint256 amountOut);
    function exactInputSingleWithPermit2(
        ExactInputSingleParams calldata params,
        Permit2Signature calldata permit2Sig
    ) external returns (uint256 amountOut);
    function exactInputMultiHopWithPermit2(
        ExactInputMultiHopParams calldata params,
        Permit2Signature calldata permit2Sig
    ) external returns (uint256 amountOut);
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
    function exactOutputSingle(ExactOutputSingleParams calldata params) external payable returns (uint256 amountIn);
    function unwrapWETH9(uint256 amountMinimum, address recipient) external payable;
    function sweepToken(address token, uint256 amountMinimum, address recipient) external payable;
}
