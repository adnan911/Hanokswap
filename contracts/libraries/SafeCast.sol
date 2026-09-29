// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SafeCast
/// @notice Contains methods for safely casting between different numeric primitive types.
library SafeCast {
    function toUint160(uint256 y) internal pure returns (uint160 z) {
        require((z = uint160(y)) == y, "SafeCast: TO_UINT160_OVERFLOW");
    }

    function toInt128(int256 y) internal pure returns (int128 z) {
        require((z = int128(y)) == y, "SafeCast: TO_INT128_OVERFLOW");
    }

    function toUint128(uint256 y) internal pure returns (uint128 z) {
        require((z = uint128(y)) == y, "SafeCast: TO_UINT128_OVERFLOW");
    }

    function toInt256(uint256 y) internal pure returns (int256 z) {
        require(y < 2**255, "SafeCast: TO_INT256_OVERFLOW");
        z = int256(y);
    }
}
