// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IGiwaUniversalRouter.sol";
import "../interfaces/IGiwaPoolFactory.sol";
import "../interfaces/IGiwaCLPool.sol";
import "../interfaces/IGiwaStablePool.sol";
import "../interfaces/IPermit2.sol";
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
/// @notice Universal Router for Giwa Chain aggregating swaps across Concentrated Liquidity and Stableswap pools with Multi-Hop SOR and Permit2.
contract GiwaUniversalRouter is IGiwaUniversalRouter, TransientReentrancyGuard {
    address public immutable factory;
    address public immutable WETH9;
    address public immutable permit2;

    modifier checkDeadline(uint256 deadline) {
        require(block.timestamp <= deadline, "Router: EXPIRED");
        _;
    }

    constructor(address _factory, address _weth9, address _permit2) {
        require(_factory != address(0) && _weth9 != address(0), "Router: ZERO_ADDRESS");
        factory = _factory;
        WETH9 = _weth9;
        permit2 = _permit2;
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
        // Handle ETH input wrapping or ERC20 pulling
        if (msg.value > 0) {
            require(params.tokenIn == WETH9, "Router: ETH_TOKEN_MISMATCH");
            require(msg.value == params.amountIn, "Router: INVALID_ETH_VALUE");
            IWETH9(WETH9).deposit{value: msg.value}();
        } else {
            _safeTransferFrom(params.tokenIn, msg.sender, address(this), params.amountIn);
        }

        amountOut = _executeSingleHop(
            params.tokenIn,
            params.tokenOut,
            params.fee,
            params.isStable,
            params.amountIn,
            params.amountOutMinimum,
            params.sqrtPriceLimitX96,
            params.recipient
        );

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

    function exactInputSingleWithPermit2(
        ExactInputSingleParams calldata params,
        Permit2Signature calldata permit2Sig
    ) external override nonReentrant checkDeadline(params.deadline) returns (uint256 amountOut) {
        require(permit2 != address(0), "Router: PERMIT2_DISABLED");
        require(permit2Sig.permit.permitted.token == params.tokenIn, "Router: PERMIT_TOKEN_MISMATCH");

        // Pull tokens via Permit2
        IPermit2(permit2).permitTransferFrom(
            permit2Sig.permit,
            IPermit2.SignatureTransferDetails({
                to: address(this),
                requestedAmount: params.amountIn
            }),
            msg.sender,
            permit2Sig.signature
        );

        amountOut = _executeSingleHop(
            params.tokenIn,
            params.tokenOut,
            params.fee,
            params.isStable,
            params.amountIn,
            params.amountOutMinimum,
            params.sqrtPriceLimitX96,
            params.recipient
        );

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

    function exactInputMultiHop(ExactInputMultiHopParams calldata params)
        external
        payable
        override
        nonReentrant
        checkDeadline(params.deadline)
        returns (uint256 amountOut)
    {
        require(params.hops.length > 0, "Router: EMPTY_HOPS");

        address initialTokenIn = params.hops[0].tokenIn;

        // Handle ETH input wrapping or ERC20 pulling
        if (msg.value > 0) {
            require(initialTokenIn == WETH9, "Router: ETH_TOKEN_MISMATCH");
            require(msg.value == params.amountIn, "Router: INVALID_ETH_VALUE");
            IWETH9(WETH9).deposit{value: msg.value}();
        } else {
            _safeTransferFrom(initialTokenIn, msg.sender, address(this), params.amountIn);
        }

        amountOut = _executeMultiHop(params.hops, params.amountIn, params.amountOutMinimum, params.recipient);

        emit RouteExecuted(
            msg.sender,
            params.recipient,
            initialTokenIn,
            params.hops[params.hops.length - 1].tokenOut,
            params.amountIn,
            amountOut,
            false
        );
    }

    function exactInputMultiHopWithPermit2(
        ExactInputMultiHopParams calldata params,
        Permit2Signature calldata permit2Sig
    ) external override nonReentrant checkDeadline(params.deadline) returns (uint256 amountOut) {
        require(permit2 != address(0), "Router: PERMIT2_DISABLED");
        require(params.hops.length > 0, "Router: EMPTY_HOPS");

        address initialTokenIn = params.hops[0].tokenIn;

        require(permit2Sig.permit.permitted.token == initialTokenIn, "Router: PERMIT_TOKEN_MISMATCH");
        IPermit2(permit2).permitTransferFrom(
            permit2Sig.permit,
            IPermit2.SignatureTransferDetails({
                to: address(this),
                requestedAmount: params.amountIn
            }),
            msg.sender,
            permit2Sig.signature
        );

        amountOut = _executeMultiHop(params.hops, params.amountIn, params.amountOutMinimum, params.recipient);

        emit RouteExecuted(
            msg.sender,
            params.recipient,
            initialTokenIn,
            params.hops[params.hops.length - 1].tokenOut,
            params.amountIn,
            amountOut,
            false
        );
    }

    function _executeSingleHop(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        bool isStable,
        uint256 amountIn,
        uint256 amountOutMinimum,
        uint160 sqrtPriceLimitX96,
        address recipient
    ) internal returns (uint256 amountOut) {
        require(tokenIn.code.length > 0 && tokenOut.code.length > 0, "Router: TOKEN_NOT_CONTRACT");
        require(tokenIn != tokenOut && amountIn > 0 && amountIn <= uint256(type(int256).max), "Router: INVALID_INPUT");
        require(recipient != address(0), "Router: ZERO_RECIPIENT");
        address pool = IGiwaPoolFactory(factory).getPool(tokenIn, tokenOut, fee, isStable);
        require(pool != address(0), "Router: POOL_NOT_FOUND");

        _safeApprove(tokenIn, pool, amountIn);

        if (isStable) {
            uint256 i = IGiwaStablePool(pool).coins(0) == tokenIn ? 0 : 1;
            uint256 j = i == 0 ? 1 : 0;
            amountOut = IGiwaStablePool(pool).exchange(i, j, amountIn, amountOutMinimum);
            _safeTransfer(tokenOut, recipient, amountOut);
        } else {
            bool zeroForOne = tokenIn < tokenOut;
            uint160 sqrtLimit = sqrtPriceLimitX96 == 0
                ? (zeroForOne ? 4295128740 : 1461446703485210103287273052203988822378723970341)
                : sqrtPriceLimitX96;

            (int256 amount0, int256 amount1) = IGiwaCLPool(pool).swap(
                recipient,
                zeroForOne,
                int256(amountIn),
                sqrtLimit,
                ""
            );
            // A price limit can leave unspent input in this router, where public
            // sweep helpers could expose it. Require a full fill atomically.
            require(uint256(zeroForOne ? amount0 : amount1) == amountIn, "Router: PARTIAL_FILL");
            amountOut = zeroForOne ? uint256(-amount1) : uint256(-amount0);
        }

        _safeApprove(tokenIn, pool, 0);
        require(amountOut >= amountOutMinimum, "Router: INSUFFICIENT_OUTPUT_AMOUNT");
    }

    function _executeMultiHop(
        SwapHop[] memory hops,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address recipient
    ) internal returns (uint256 currentAmount) {
        currentAmount = amountIn;
        uint256 len = hops.length;

        for (uint256 i = 0; i < len; i++) {
            SwapHop memory hop = hops[i];
            if (i > 0) require(hops[i - 1].tokenOut == hop.tokenIn, "Router: DISCONNECTED_HOPS");
            address targetRecipient = (i == len - 1) ? recipient : address(this);
            uint256 minOut = (i == len - 1) ? amountOutMinimum : 1;

            currentAmount = _executeSingleHop(
                hop.tokenIn,
                hop.tokenOut,
                hop.fee,
                hop.isStable,
                currentAmount,
                minOut,
                hop.sqrtPriceLimitX96,
                targetRecipient
            );
        }
    }

    function exactInput(ExactInputParams calldata params)
        external
        payable
        override
        nonReentrant
        checkDeadline(params.deadline)
        returns (uint256 amountOut)
    {
        revert("Router: EXACT_INPUT_PATH_UNSUPPORTED");
    }

    function exactOutputSingle(ExactOutputSingleParams calldata params)
        external
        payable
        override
        nonReentrant
        checkDeadline(params.deadline)
        returns (uint256 amountIn)
    {
        revert("Router: EXACT_OUTPUT_UNSUPPORTED");
    }

    function unwrapWETH9(uint256, address) external payable override nonReentrant {
        // Output is delivered directly to the swap recipient. There is no
        // atomic multicall or per-user custody accounting for public sweeps.
        revert("Router: UNWRAP_UNSUPPORTED");
    }

    function sweepToken(address, uint256, address) external payable override nonReentrant {
        revert("Router: SWEEP_UNSUPPORTED");
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
        require(token.code.length > 0, "Router: TOKEN_NOT_CONTRACT");
        uint256 beforeBalance = IERC20PermitTransfer(token).balanceOf(to);
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20PermitTransfer.transferFrom.selector, from, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Router: TRANSFER_FROM_FAILED");
        require(IERC20PermitTransfer(token).balanceOf(to) == beforeBalance + value, "Router: UNSUPPORTED_TRANSFER_FEE");
    }
}
