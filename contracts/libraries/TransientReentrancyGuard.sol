// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TransientReentrancyGuard
/// @notice Gas-optimized reentrancy lock utilizing Cancun EVM EIP-1153 transient storage (TSTORE / TLOAD).
/// @dev Reduces gas overhead from ~20,000 gas (SSTORE) to ~100 gas per invocation on Giwa Chain (op-reth).
abstract contract TransientReentrancyGuard {
    // keccak256("giwa.transient.reentrancy.guard")
    bytes32 private constant REENTRANCY_SLOT = 0xb532073b72e1fef2d324f3dd033ea331ee0d9c4cfa5bedba4e00f3d374264997;

    error ReentrancyGuardReentrantCall();

    modifier nonReentrant() {
        _enter();
        _;
        _exit();
    }

    function _enter() internal {
        assembly {
            if tload(REENTRANCY_SLOT) {
                // Revert with ReentrancyGuardReentrantCall() selector: 0x3ee52b14
                mstore(0x00, 0x3ee52b14)
                revert(0x1c, 0x04)
            }
            tstore(REENTRANCY_SLOT, 1)
        }
    }

    function _exit() internal {
        assembly {
            tstore(REENTRANCY_SLOT, 0)
        }
    }
}
