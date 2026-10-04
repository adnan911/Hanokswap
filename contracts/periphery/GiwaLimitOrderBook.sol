// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../libraries/TransientReentrancyGuard.sol";

interface IERC20Order {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title GiwaLimitOrderBook
/// @notice Sub-second Flashblocks Limit Order Engine for Hanokswap on Giwa Chain.
contract GiwaLimitOrderBook is TransientReentrancyGuard {
    enum OrderStatus { ACTIVE, FILLED, CANCELLED }

    struct LimitOrder {
        bytes32 orderId;
        address maker;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 createdAt;
        uint256 expiresAt;
        OrderStatus status;
    }

    mapping(bytes32 => LimitOrder) public orders;
    mapping(address => bytes32[]) private _userOrders;
    bytes32[] public activeOrderIds;

    event OrderCreated(
        bytes32 indexed orderId,
        address indexed maker,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 expiresAt
    );
    event OrderFilled(bytes32 indexed orderId, address indexed keeper, uint256 amountOutReceived);
    event OrderCancelled(bytes32 indexed orderId);

    error OrderNotActive();
    error Unauthorized();
    error OrderExpired();
    error InsufficientOutput();

    function createOrder(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 durationSeconds
    ) external nonReentrant returns (bytes32) {
        require(amountIn > 0 && minAmountOut > 0, "Limit: ZERO_AMOUNT");
        require(tokenIn != tokenOut, "Limit: IDENTICAL_TOKEN");

        uint256 expiresAt = durationSeconds == 0 ? block.timestamp + 30 days : block.timestamp + durationSeconds;

        bytes32 orderId = keccak256(
            abi.encodePacked(
                msg.sender,
                tokenIn,
                tokenOut,
                amountIn,
                minAmountOut,
                block.timestamp,
                activeOrderIds.length
            )
        );

        orders[orderId] = LimitOrder({
            orderId: orderId,
            maker: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            status: OrderStatus.ACTIVE
        });

        _userOrders[msg.sender].push(orderId);
        activeOrderIds.push(orderId);

        // Pull maker funds into escrow
        bool success = IERC20Order(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        require(success, "Limit: ESCROW_FAILED");

        emit OrderCreated(orderId, msg.sender, tokenIn, tokenOut, amountIn, minAmountOut, expiresAt);
        return orderId;
    }

    function cancelOrder(bytes32 orderId) external nonReentrant {
        LimitOrder storage order = orders[orderId];
        if (order.status != OrderStatus.ACTIVE) revert OrderNotActive();
        if (order.maker != msg.sender) revert Unauthorized();

        order.status = OrderStatus.CANCELLED;

        // Refund tokenIn to maker
        bool success = IERC20Order(order.tokenIn).transfer(order.maker, order.amountIn);
        require(success, "Limit: REFUND_FAILED");

        emit OrderCancelled(orderId);
    }

    /// @notice Keeper / Sequencer fills limit order when spot price condition is met
    function fillOrder(
        bytes32 orderId,
        uint256 amountOutProvided
    ) external nonReentrant {
        LimitOrder storage order = orders[orderId];
        if (order.status != OrderStatus.ACTIVE) revert OrderNotActive();
        if (block.timestamp > order.expiresAt) revert OrderExpired();
        if (amountOutProvided < order.minAmountOut) revert InsufficientOutput();

        order.status = OrderStatus.FILLED;

        // Pull tokenOut from keeper/router and send to maker
        bool success1 = IERC20Order(order.tokenOut).transferFrom(msg.sender, order.maker, amountOutProvided);
        require(success1, "Limit: TRANSFER_OUT_FAILED");

        // Release tokenIn from escrow to keeper
        bool success2 = IERC20Order(order.tokenIn).transfer(msg.sender, order.amountIn);
        require(success2, "Limit: RELEASE_IN_FAILED");

        emit OrderFilled(orderId, msg.sender, amountOutProvided);
    }

    function getUserOrders(address user) external view returns (bytes32[] memory) {
        return _userOrders[user];
    }

    function getActiveOrderCount() external view returns (uint256) {
        return activeOrderIds.length;
    }
}
