// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IGiwaUniversalRouter.sol";
import "../libraries/TransientReentrancyGuard.sol";

interface IERC20DCA {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title GiwaDCAStreamer
/// @notice Automated non-custodial Dollar Cost Averaging (DCA) streaming contract for Giwa Chain.
contract GiwaDCAStreamer is TransientReentrancyGuard {
    enum StreamStatus { ACTIVE, COMPLETED, CANCELLED }

    struct DCAStream {
        bytes32 streamId;
        address owner;
        address tokenIn;
        address tokenOut;
        uint256 amountPerInterval;
        uint256 intervalSeconds;
        uint256 totalIntervals;
        uint256 intervalsCompleted;
        uint256 lastExecutionTime;
        uint256 minAmountOutPerInterval;
        StreamStatus status;
    }

    IGiwaUniversalRouter public immutable router;
    mapping(bytes32 => DCAStream) public streams;
    mapping(address => bytes32[]) private _userStreams;
    bytes32[] public activeStreamIds;

    event StreamCreated(
        bytes32 indexed streamId,
        address indexed owner,
        address tokenIn,
        address tokenOut,
        uint256 amountPerInterval,
        uint256 intervalSeconds,
        uint256 totalIntervals
    );
    event StreamExecuted(bytes32 indexed streamId, uint256 intervalIndex, uint256 amountOut);
    event StreamCancelled(bytes32 indexed streamId, uint256 refundAmount);

    error StreamNotActive();
    error Unauthorized();
    error IntervalNotReached();
    error SlippageExceeded();

    constructor(address _router) {
        require(_router != address(0), "DCA: ZERO_ROUTER");
        router = IGiwaUniversalRouter(_router);
    }

    function createStream(
        address tokenIn,
        address tokenOut,
        uint256 amountPerInterval,
        uint256 intervalSeconds,
        uint256 totalIntervals,
        uint256 minAmountOutPerInterval
    ) external nonReentrant returns (bytes32) {
        require(amountPerInterval > 0 && totalIntervals > 0, "DCA: INVALID_PARAMS");
        require(intervalSeconds >= 60, "DCA: INTERVAL_TOO_SHORT"); // min 1 minute

        uint256 totalDeposit = amountPerInterval * totalIntervals;

        bytes32 streamId = keccak256(
            abi.encodePacked(
                msg.sender,
                tokenIn,
                tokenOut,
                amountPerInterval,
                intervalSeconds,
                totalIntervals,
                block.timestamp,
                activeStreamIds.length
            )
        );

        streams[streamId] = DCAStream({
            streamId: streamId,
            owner: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountPerInterval: amountPerInterval,
            intervalSeconds: intervalSeconds,
            totalIntervals: totalIntervals,
            intervalsCompleted: 0,
            lastExecutionTime: 0,
            minAmountOutPerInterval: minAmountOutPerInterval,
            status: StreamStatus.ACTIVE
        });

        _userStreams[msg.sender].push(streamId);
        activeStreamIds.push(streamId);

        // Pull full token amount into DCA escrow
        bool success = IERC20DCA(tokenIn).transferFrom(msg.sender, address(this), totalDeposit);
        require(success, "DCA: ESCROW_FAILED");

        emit StreamCreated(
            streamId,
            msg.sender,
            tokenIn,
            tokenOut,
            amountPerInterval,
            intervalSeconds,
            totalIntervals
        );
        return streamId;
    }

    function executeNextInterval(
        bytes32 streamId,
        uint24 poolFee,
        bool isStable
    ) external nonReentrant returns (uint256 amountOut) {
        DCAStream storage stream = streams[streamId];
        if (stream.status != StreamStatus.ACTIVE) revert StreamNotActive();
        if (stream.intervalsCompleted >= stream.totalIntervals) revert StreamNotActive();
        if (block.timestamp < stream.lastExecutionTime + stream.intervalSeconds) revert IntervalNotReached();

        stream.intervalsCompleted++;
        stream.lastExecutionTime = block.timestamp;

        // Approve router for single swap amount
        IERC20DCA(stream.tokenIn).approve(address(router), stream.amountPerInterval);

        IGiwaUniversalRouter.ExactInputSingleParams memory params = IGiwaUniversalRouter.ExactInputSingleParams({
            tokenIn: stream.tokenIn,
            tokenOut: stream.tokenOut,
            fee: poolFee,
            recipient: stream.owner,
            deadline: block.timestamp + 300,
            amountIn: stream.amountPerInterval,
            amountOutMinimum: stream.minAmountOutPerInterval,
            sqrtPriceLimitX96: 0,
            isStable: isStable
        });

        amountOut = router.exactInputSingle(params);

        if (stream.intervalsCompleted == stream.totalIntervals) {
            stream.status = StreamStatus.COMPLETED;
        }

        emit StreamExecuted(streamId, stream.intervalsCompleted, amountOut);
    }

    function cancelStream(bytes32 streamId) external nonReentrant {
        DCAStream storage stream = streams[streamId];
        if (stream.status != StreamStatus.ACTIVE) revert StreamNotActive();
        if (stream.owner != msg.sender) revert Unauthorized();

        stream.status = StreamStatus.CANCELLED;

        uint256 remainingIntervals = stream.totalIntervals - stream.intervalsCompleted;
        uint256 refundAmount = remainingIntervals * stream.amountPerInterval;

        if (refundAmount > 0) {
            bool success = IERC20DCA(stream.tokenIn).transfer(stream.owner, refundAmount);
            require(success, "DCA: REFUND_FAILED");
        }

        emit StreamCancelled(streamId, refundAmount);
    }

    function getUserStreams(address user) external view returns (bytes32[] memory) {
        return _userStreams[user];
    }
}
