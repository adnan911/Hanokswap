// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./FullMath.sol";

/// @title SqrtPriceMath
/// @notice Computes token amounts from changes in sqrt price and vice versa for concentrated liquidity.
library SqrtPriceMath {
    function getAmount0Delta(
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint128 liquidity,
        bool roundUp
    ) internal pure returns (uint256 amount0) {
        unchecked {
            if (sqrtRatioAX96 > sqrtRatioBX96) (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);

            uint256 numerator1 = uint256(liquidity) << 96;
            uint256 numerator2 = sqrtRatioBX96 - sqrtRatioAX96;

            require(sqrtRatioAX96 > 0, "SqrtPriceMath: ZERO_SQRT_PRICE");

            return
                roundUp
                    ? FullMath.mulDivRoundingUp(
                        FullMath.mulDivRoundingUp(numerator1, numerator2, sqrtRatioBX96),
                        1,
                        sqrtRatioAX96
                    )
                    : FullMath.mulDiv(numerator1, numerator2, sqrtRatioBX96) / sqrtRatioAX96;
        }
    }

    function getAmount1Delta(
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint128 liquidity,
        bool roundUp
    ) internal pure returns (uint256 amount1) {
        unchecked {
            if (sqrtRatioAX96 > sqrtRatioBX96) (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);

            return
                roundUp
                    ? FullMath.mulDivRoundingUp(liquidity, sqrtRatioBX96 - sqrtRatioAX96, 1 << 96)
                    : FullMath.mulDiv(liquidity, sqrtRatioBX96 - sqrtRatioAX96, 1 << 96);
        }
    }

    function getNextSqrtPriceFromAmount0RoundingUp(
        uint160 sqrtPX96,
        uint128 liquidity,
        uint256 amount,
        bool add
    ) internal pure returns (uint160) {
        if (amount == 0) return sqrtPX96;
        uint256 numerator1 = uint256(liquidity) << 96;

        if (add) {
            uint256 product;
            if ((product = amount * sqrtPX96) / amount == sqrtPX96) {
                uint256 denominator = numerator1 + product;
                if (denominator >= numerator1) {
                    return uint160(FullMath.mulDivRoundingUp(numerator1, sqrtPX96, denominator));
                }
            }
            return uint160(FullMath.mulDivRoundingUp(numerator1, 1, (numerator1 / sqrtPX96) + amount));
        } else {
            uint256 product;
            require((product = amount * sqrtPX96) / amount == sqrtPX96 && numerator1 > product, "SqrtPriceMath: OVERFLOW");
            uint256 denominator = numerator1 - product;
            return uint160(FullMath.mulDivRoundingUp(numerator1, sqrtPX96, denominator));
        }
    }

    function getNextSqrtPriceFromAmount1RoundingDown(
        uint160 sqrtPX96,
        uint128 liquidity,
        uint256 amount,
        bool add
    ) internal pure returns (uint160) {
        if (add) {
            uint256 quotient = (amount <= type(uint160).max)
                ? (amount << 96) / liquidity
                : FullMath.mulDiv(amount, 1 << 96, liquidity);

            return uint160(uint256(sqrtPX96) + quotient);
        } else {
            uint256 quotient = (amount <= type(uint160).max)
                ? FullMath.mulDivRoundingUp(amount, 1 << 96, liquidity)
                : FullMath.mulDivRoundingUp(amount, 1 << 96, liquidity);

            require(sqrtPX96 > quotient, "SqrtPriceMath: UNDERFLOW");
            return uint160(sqrtPX96 - quotient);
        }
    }
}
