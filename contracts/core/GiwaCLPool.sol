// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IGiwaCLPool.sol";
import "../interfaces/IGiwaPoolFactory.sol";
import "../libraries/FullMath.sol";
import "../libraries/TickMath.sol";
import "../libraries/SqrtPriceMath.sol";
import "../libraries/SwapMath.sol";
import "../libraries/TickBitmap.sol";
import "../libraries/SafeCast.sol";
import "../libraries/TransientReentrancyGuard.sol";

interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface IGiwaSwapCallback {
    function giwaSwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external;
}

interface IGiwaMintCallback {
    function giwaMintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes calldata data) external;
}

interface IGiwaFlashCallback {
    function giwaFlashCallback(uint256 fee0, uint256 fee1, bytes calldata data) external;
}

/// @title GiwaCLPool
/// @notice Production Concentrated Liquidity AMM Pool on Giwa Chain with Cancun transient storage reentrancy protection.
contract GiwaCLPool is IGiwaCLPool, TransientReentrancyGuard {
    using SafeCast for uint256;
    using SafeCast for int256;
    using TickBitmap for mapping(int16 => uint256);

    address public override immutable factory;
    address public override immutable token0;
    address public override immutable token1;
    uint24 public override immutable fee;
    int24 public override immutable tickSpacing;
    uint128 public override immutable maxLiquidityPerTick;
    address public immutable feeVault;

    struct PositionInfo {
        uint128 liquidity;
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    struct TickInfo {
        uint128 liquidityGross;
        int128 liquidityNet;
        uint256 feeGrowthOutside0X128;
        uint256 feeGrowthOutside1X128;
        bool initialized;
    }

    Slot0 public override slot0;
    uint128 public liquidity;
    uint256 public feeGrowthGlobal0X128;
    uint256 public feeGrowthGlobal1X128;

    mapping(int24 => TickInfo) public ticks;
    mapping(int16 => uint256) public tickBitmap;
    mapping(bytes32 => PositionInfo) public positions;

    constructor(
        address _token0,
        address _token1,
        uint24 _fee,
        int24 _tickSpacing,
        address _feeVault
    ) {
        factory = msg.sender;
        token0 = _token0;
        token1 = _token1;
        fee = _fee;
        tickSpacing = _tickSpacing;
        feeVault = _feeVault;
        maxLiquidityPerTick = type(uint128).max / uint128(uint24((TickMath.MAX_TICK - TickMath.MIN_TICK) / _tickSpacing + 1));
    }

    function initialize(uint160 sqrtPriceX96) external override {
        require(slot0.sqrtPriceX96 == 0, "CLPool: ALREADY_INITIALIZED");
        int24 tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);
        slot0 = Slot0({
            sqrtPriceX96: sqrtPriceX96,
            tick: tick,
            observationIndex: 0,
            observationCardinality: 1,
            observationCardinalityNext: 1,
            feeProtocol: 0,
            unlocked: true
        });
        emit Initialize(sqrtPriceX96, tick);
    }

    function _positionKey(address owner, int24 tickLower, int24 tickUpper) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(owner, tickLower, tickUpper));
    }

    function mint(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount,
        bytes calldata data
    ) external override nonReentrant returns (uint256 amount0, uint256 amount1) {
        require(tickLower < tickUpper && tickLower >= TickMath.MIN_TICK && tickUpper <= TickMath.MAX_TICK, "CLPool: INVALID_TICKS");
        require(tickLower % tickSpacing == 0 && tickUpper % tickSpacing == 0, "CLPool: TICK_SPACING");
        require(amount > 0, "CLPool: AMOUNT_ZERO");

        Slot0 memory _slot0 = slot0;
        require(_slot0.sqrtPriceX96 > 0, "CLPool: NOT_INITIALIZED");

        if (_slot0.tick < tickLower) {
            amount0 = SqrtPriceMath.getAmount0Delta(
                TickMath.getSqrtRatioAtTick(tickLower),
                TickMath.getSqrtRatioAtTick(tickUpper),
                amount,
                true
            );
        } else if (_slot0.tick < tickUpper) {
            amount0 = SqrtPriceMath.getAmount0Delta(
                _slot0.sqrtPriceX96,
                TickMath.getSqrtRatioAtTick(tickUpper),
                amount,
                true
            );
            amount1 = SqrtPriceMath.getAmount1Delta(
                TickMath.getSqrtRatioAtTick(tickLower),
                _slot0.sqrtPriceX96,
                amount,
                true
            );
            liquidity += amount;
        } else {
            amount1 = SqrtPriceMath.getAmount1Delta(
                TickMath.getSqrtRatioAtTick(tickLower),
                TickMath.getSqrtRatioAtTick(tickUpper),
                amount,
                true
            );
        }

        // Update position info
        bytes32 posKey = _positionKey(recipient, tickLower, tickUpper);
        positions[posKey].liquidity += amount;

        // Flip ticks in bitmap if new
        TickInfo storage tickInfoLower = ticks[tickLower];
        if (tickInfoLower.liquidityGross == 0) {
            tickBitmap.flipTick(tickLower, tickSpacing);
            tickInfoLower.initialized = true;
        }
        tickInfoLower.liquidityGross += amount;
        tickInfoLower.liquidityNet += int128(int256(uint256(amount)));

        TickInfo storage tickInfoUpper = ticks[tickUpper];
        if (tickInfoUpper.liquidityGross == 0) {
            tickBitmap.flipTick(tickUpper, tickSpacing);
            tickInfoUpper.initialized = true;
        }
        tickInfoUpper.liquidityGross += amount;
        tickInfoUpper.liquidityNet -= int128(int256(uint256(amount)));

        uint256 balance0Before = IERC20Minimal(token0).balanceOf(address(this));
        uint256 balance1Before = IERC20Minimal(token1).balanceOf(address(this));

        if (data.length > 0) {
            IGiwaMintCallback(msg.sender).giwaMintCallback(amount0, amount1, data);
        } else {
            if (amount0 > 0) _safeTransferFrom(token0, msg.sender, address(this), amount0);
            if (amount1 > 0) _safeTransferFrom(token1, msg.sender, address(this), amount1);
        }

        require(balance0Before + amount0 <= IERC20Minimal(token0).balanceOf(address(this)), "CLPool: MINT_TOKEN0");
        require(balance1Before + amount1 <= IERC20Minimal(token1).balanceOf(address(this)), "CLPool: MINT_TOKEN1");

        emit Mint(msg.sender, recipient, tickLower, tickUpper, amount, amount0, amount1);
    }

    function burn(
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external override nonReentrant returns (uint256 amount0, uint256 amount1) {
        bytes32 posKey = _positionKey(msg.sender, tickLower, tickUpper);
        PositionInfo storage position = positions[posKey];
        require(position.liquidity >= amount, "CLPool: INSUFFICIENT_POSITION");

        Slot0 memory _slot0 = slot0;

        if (_slot0.tick < tickLower) {
            amount0 = SqrtPriceMath.getAmount0Delta(
                TickMath.getSqrtRatioAtTick(tickLower),
                TickMath.getSqrtRatioAtTick(tickUpper),
                amount,
                false
            );
        } else if (_slot0.tick < tickUpper) {
            amount0 = SqrtPriceMath.getAmount0Delta(
                _slot0.sqrtPriceX96,
                TickMath.getSqrtRatioAtTick(tickUpper),
                amount,
                false
            );
            amount1 = SqrtPriceMath.getAmount1Delta(
                TickMath.getSqrtRatioAtTick(tickLower),
                _slot0.sqrtPriceX96,
                amount,
                false
            );
            liquidity -= amount;
        } else {
            amount1 = SqrtPriceMath.getAmount1Delta(
                TickMath.getSqrtRatioAtTick(tickLower),
                TickMath.getSqrtRatioAtTick(tickUpper),
                amount,
                false
            );
        }

        position.liquidity -= amount;
        position.tokensOwed0 += uint128(amount0);
        position.tokensOwed1 += uint128(amount1);

        // Synchronize lower and upper ticks
        TickInfo storage tickInfoLower = ticks[tickLower];
        tickInfoLower.liquidityGross -= amount;
        tickInfoLower.liquidityNet -= int128(int256(uint256(amount)));
        if (tickInfoLower.liquidityGross == 0) {
            tickBitmap.flipTick(tickLower, tickSpacing);
            tickInfoLower.initialized = false;
        }

        TickInfo storage tickInfoUpper = ticks[tickUpper];
        tickInfoUpper.liquidityGross -= amount;
        tickInfoUpper.liquidityNet += int128(int256(uint256(amount)));
        if (tickInfoUpper.liquidityGross == 0) {
            tickBitmap.flipTick(tickUpper, tickSpacing);
            tickInfoUpper.initialized = false;
        }

        emit Burn(msg.sender, tickLower, tickUpper, amount, amount0, amount1);
    }

    function collect(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount0Requested,
        uint128 amount1Requested
    ) external override nonReentrant returns (uint128 amount0, uint128 amount1) {
        bytes32 posKey = _positionKey(msg.sender, tickLower, tickUpper);
        PositionInfo storage position = positions[posKey];

        amount0 = amount0Requested > position.tokensOwed0 ? position.tokensOwed0 : amount0Requested;
        amount1 = amount1Requested > position.tokensOwed1 ? position.tokensOwed1 : amount1Requested;

        if (amount0 > 0) {
            position.tokensOwed0 -= amount0;
            _safeTransfer(token0, recipient, amount0);
        }
        if (amount1 > 0) {
            position.tokensOwed1 -= amount1;
            _safeTransfer(token1, recipient, amount1);
        }

        emit Collect(msg.sender, recipient, tickLower, tickUpper, amount0, amount1);
    }

    struct SwapStepState {
        uint160 sqrtPriceStartX96;
        int24 tickNext;
        bool initialized;
        uint160 sqrtPriceNextX96;
        uint256 amountIn;
        uint256 amountOut;
        uint256 feeAmount;
    }

    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external override nonReentrant returns (int256 amount0, int256 amount1) {
        require(amountSpecified != 0, "CLPool: AMOUNT_ZERO");
        Slot0 memory _slot0 = slot0;
        require(_slot0.sqrtPriceX96 > 0, "CLPool: NOT_INITIALIZED");

        if (zeroForOne) {
            require(sqrtPriceLimitX96 < _slot0.sqrtPriceX96 && sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO, "CLPool: RATIO_LIMIT");
        } else {
            require(sqrtPriceLimitX96 > _slot0.sqrtPriceX96 && sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO, "CLPool: RATIO_LIMIT");
        }

        bool exactInput = amountSpecified > 0;
        int256 amountSpecifiedRemaining = amountSpecified;
        int256 amountCalculated = 0;
        uint160 currentSqrtPriceX96 = _slot0.sqrtPriceX96;
        int24 currentTick = _slot0.tick;
        uint128 currentLiquidity = liquidity;

        while (amountSpecifiedRemaining != 0 && currentSqrtPriceX96 != sqrtPriceLimitX96) {
            SwapStepState memory step;
            step.sqrtPriceStartX96 = currentSqrtPriceX96;

            (step.tickNext, step.initialized) = tickBitmap.nextInitializedTickWithinOneWord(
                currentTick,
                tickSpacing,
                zeroForOne
            );

            if (step.tickNext < TickMath.MIN_TICK) step.tickNext = TickMath.MIN_TICK;
            else if (step.tickNext > TickMath.MAX_TICK) step.tickNext = TickMath.MAX_TICK;

            step.sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(step.tickNext);

            (currentSqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount) = SwapMath.computeSwapStep(
                currentSqrtPriceX96,
                (zeroForOne ? step.sqrtPriceNextX96 < sqrtPriceLimitX96 : step.sqrtPriceNextX96 > sqrtPriceLimitX96)
                    ? sqrtPriceLimitX96
                    : step.sqrtPriceNextX96,
                currentLiquidity,
                amountSpecifiedRemaining,
                fee
            );

            if (exactInput) {
                amountSpecifiedRemaining -= int256(step.amountIn + step.feeAmount);
                amountCalculated -= int256(step.amountOut);
            } else {
                amountSpecifiedRemaining += int256(step.amountOut);
                amountCalculated += int256(step.amountIn + step.feeAmount);
            }

            if (currentSqrtPriceX96 == step.sqrtPriceNextX96) {
                if (step.initialized) {
                    int128 liquidityNet = ticks[step.tickNext].liquidityNet;
                    if (zeroForOne) liquidityNet = -liquidityNet;
                    currentLiquidity = liquidityNet < 0
                        ? currentLiquidity - uint128(-int128(liquidityNet))
                        : currentLiquidity + uint128(liquidityNet);
                }
                currentTick = zeroForOne ? step.tickNext - 1 : step.tickNext;
            } else if (currentSqrtPriceX96 != step.sqrtPriceStartX96) {
                currentTick = TickMath.getTickAtSqrtRatio(currentSqrtPriceX96);
            }
        }

        if (currentTick != _slot0.tick) {
            _slot0.sqrtPriceX96 = currentSqrtPriceX96;
            _slot0.tick = currentTick;
            slot0 = _slot0;
        } else if (currentSqrtPriceX96 != _slot0.sqrtPriceX96) {
            _slot0.sqrtPriceX96 = currentSqrtPriceX96;
            slot0 = _slot0;
        }

        if (liquidity != currentLiquidity) liquidity = currentLiquidity;

        (amount0, amount1) = zeroForOne == exactInput
            ? (amountSpecified - amountSpecifiedRemaining, amountCalculated)
            : (amountCalculated, amountSpecified - amountSpecifiedRemaining);

        if (zeroForOne) {
            if (amount1 < 0) _safeTransfer(token1, recipient, uint256(-amount1));
            uint256 balance0Before = IERC20Minimal(token0).balanceOf(address(this));
            if (data.length > 0) {
                IGiwaSwapCallback(msg.sender).giwaSwapCallback(amount0, amount1, data);
            } else {
                _safeTransferFrom(token0, msg.sender, address(this), uint256(amount0));
            }
            require(balance0Before + uint256(amount0) <= IERC20Minimal(token0).balanceOf(address(this)), "CLPool: SWAP_TOKEN0");
        } else {
            if (amount0 < 0) _safeTransfer(token0, recipient, uint256(-amount0));
            uint256 balance1Before = IERC20Minimal(token1).balanceOf(address(this));
            if (data.length > 0) {
                IGiwaSwapCallback(msg.sender).giwaSwapCallback(amount0, amount1, data);
            } else {
                _safeTransferFrom(token1, msg.sender, address(this), uint256(amount1));
            }
            require(balance1Before + uint256(amount1) <= IERC20Minimal(token1).balanceOf(address(this)), "CLPool: SWAP_TOKEN1");
        }

        emit Swap(msg.sender, recipient, amount0, amount1, currentSqrtPriceX96, currentLiquidity, currentTick);
    }

    function flash(
        address recipient,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external override nonReentrant {
        uint256 fee0 = FullMath.mulDivRoundingUp(amount0, fee, 1e6);
        uint256 fee1 = FullMath.mulDivRoundingUp(amount1, fee, 1e6);

        uint256 balance0Before = IERC20Minimal(token0).balanceOf(address(this));
        uint256 balance1Before = IERC20Minimal(token1).balanceOf(address(this));

        if (amount0 > 0) _safeTransfer(token0, recipient, amount0);
        if (amount1 > 0) _safeTransfer(token1, recipient, amount1);

        IGiwaFlashCallback(msg.sender).giwaFlashCallback(fee0, fee1, data);

        require(balance0Before + fee0 <= IERC20Minimal(token0).balanceOf(address(this)), "CLPool: FLASH_TOKEN0");
        require(balance1Before + fee1 <= IERC20Minimal(token1).balanceOf(address(this)), "CLPool: FLASH_TOKEN1");

        emit Flash(recipient, msg.sender, amount0, amount1, fee0, fee1);
    }

    function _safeTransfer(address token, address to, uint256 value) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20Minimal.transfer.selector, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "CLPool: TRANSFER_FAILED");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 value) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20Minimal.transferFrom.selector, from, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "CLPool: TRANSFER_FROM_FAILED");
    }
}
