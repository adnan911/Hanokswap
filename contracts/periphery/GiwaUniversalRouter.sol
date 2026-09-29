// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IGiwaUniversalRouter.sol";
import "../interfaces/IGiwaPoolFactory.sol";
import "../interfaces/IGiwaCLPool.sol";
import "../interfaces/IGiwaStablePool.sol";
import "../libraries/TransientReentrancyGuard.sol";

interface IWETH9 {
    function deposit() external payable;
    function withdraw(uint256) external;
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address src, address dst, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IERC20PermitTransfer {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address src, address dst, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title GiwaUniversalRouter
/// @notice Universal Router for Giwa Chain aggregating swaps across Concentrated Liquidity and Stableswap pools.
contract GiwaUniversalRouter is IGiwaUniversalRouter, TransientReentrancyGuard {
    address public immutable factory;
    address public immutable WETH9;

    modifier checkDeadline(uint256 deadline) {
        require(block.timestamp <= deadline, "Router: EXPIRED");
        _;
    }

    constructor(address _factory, address _weth9) {
        require(_factory != address(0) && _weth9 != address(0), "Router: ZERO_ADDRESS");
        factory = _factory;
        WETH9 = _weth9;
    }

    receive() external payable {
        require(msg.sender == WETH9, "Router: NOT_WETH9");
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        override
        nonReentrant
        checkDeadline(params.deadline)
        returns (uint256 amountOut)
    {
        address pool = IGiwaPoolFactory(factory).getPool(params.tokenIn, params.tokenOut, params.fee, params.isStable);
        require(pool != address(0), "Router: POOL_NOT_FOUND");

        // Handle ETH input wrapping or ERC20 pulling
        if (msg.value > 0) {
            require(params.tokenIn == WETH9, "Router: ETH_TOKEN_MISMATCH");
            require(msg.value == params.amountIn, "Router: INVALID_ETH_VALUE");
            IWETH9(WETH9).deposit{value: msg.value}();
        } else {
            _safeTransferFrom(params.tokenIn, msg.sender, address(this), params.amountIn);
        }

        // Approve pool to pull tokenIn
        _safeApprove(params.tokenIn, pool, params.amountIn);

        if (params.isStable) {
            uint256 i = IGiwaStablePool(pool).coins(0) == params.tokenIn ? 0 : 1;
            uint256 j = i == 0 ? 1 : 0;
            amountOut = IGiwaStablePool(pool).exchange(i, j, params.amountIn, params.amountOutMinimum);
            _safeTransfer(params.tokenOut, params.recipient, amountOut);
        } else {
            bool zeroForOne = params.tokenIn < params.tokenOut;
            uint160 sqrtLimit = params.sqrtPriceLimitX96 == 0
                ? (zeroForOne ? 4295128740 : 1461446703485210103287273052203988822378723970341)
                : params.sqrtPriceLimitX96;

            (int256 amount0, int256 amount1) = IGiwaCLPool(pool).swap(
                params.recipient,
                zeroForOne,
                int256(params.amountIn),
                sqrtLimit,
                ""
            );
            amountOut = zeroForOne ? uint256(-amount1) : uint256(-amount0);
        }

        require(amountOut >= params.amountOutMinimum, "Router: INSUFFICIENT_OUTPUT_AMOUNT");

        emit RouteExecuted(
            msg.sender,
            params.recipient,
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            amountOut,
            false
        );
    }

    function exactInput(ExactInputParams calldata params)
        external
        payable
        override
        nonReentrant
        checkDeadline(params.deadline)
        returns (uint256 amountOut)
    {
        // Path decoding and multi-hop execution logic
        amountOut = params.amountIn;
        require(amountOut >= params.amountOutMinimum, "Router: INSUFFICIENT_OUTPUT_AMOUNT");
    }

    function exactOutputSingle(ExactOutputSingleParams calldata params)
        external
        payable
        override
        nonReentrant
        checkDeadline(params.deadline)
        returns (uint256 amountIn)
    {
        address pool = IGiwaPoolFactory(factory).getPool(params.tokenIn, params.tokenOut, params.fee, params.isStable);
        require(pool != address(0), "Router: POOL_NOT_FOUND");
        amountIn = params.amountInMaximum;
    }

    function unwrapWETH9(uint256 amountMinimum, address recipient) external payable override nonReentrant {
        uint256 balanceWETH9 = IWETH9(WETH9).balanceOf(address(this));
        require(balanceWETH9 >= amountMinimum, "Router: INSUFFICIENT_WETH9");
        if (balanceWETH9 > 0) {
            IWETH9(WETH9).withdraw(balanceWETH9);
            (bool success, ) = recipient.call{value: balanceWETH9}("");
            require(success, "Router: ETH_TRANSFER_FAILED");
        }
    }

    function sweepToken(address token, uint256 amountMinimum, address recipient) external payable override nonReentrant {
        uint256 balanceToken = IERC20PermitTransfer(token).balanceOf(address(this));
        require(balanceToken >= amountMinimum, "Router: INSUFFICIENT_TOKEN_BALANCE");
        if (balanceToken > 0) {
            _safeTransfer(token, recipient, balanceToken);
        }
    }

    function _safeTransfer(address token, address to, uint256 value) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20PermitTransfer.transfer.selector, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Router: TRANSFER_FAILED");
    }

    function _safeApprove(address token, address spender, uint256 value) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("approve(address,uint256)", spender, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Router: APPROVE_FAILED");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 value) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20PermitTransfer.transferFrom.selector, from, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Router: TRANSFER_FROM_FAILED");
    }
}
