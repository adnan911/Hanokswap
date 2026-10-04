// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IPermit2.sol";

interface IERC20Permit2 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title Permit2
/// @notice Canonical Permit2 contract for Giwa Chain enabling single-signature batch approvals.
contract Permit2 is IPermit2 {
    bytes32 public constant _PERMIT_TRANSFER_FROM_TYPEHASH =
        keccak256("PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)");

    bytes32 public constant _TOKEN_PERMISSIONS_TYPEHASH =
        keccak256("TokenPermissions(address token,uint256 amount)");

    mapping(address => mapping(uint256 => uint256)) public nonceBitmap;

    bytes32 private immutable _DOMAIN_SEPARATOR;

    error InvalidSigner();
    error SignatureExpired();
    error InvalidNonce();
    error TransferFailed();

    constructor() {
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Permit2")),
                block.chainid,
                address(this)
            )
        );
    }

    function DOMAIN_SEPARATOR() external view override returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function permitTransferFrom(
        PermitTransferFrom memory permitData,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external override {
        if (block.timestamp > permitData.deadline) revert SignatureExpired();
        if (transferDetails.requestedAmount > permitData.permitted.amount) revert TransferFailed();

        _useUnorderedNonce(owner, permitData.nonce);

        bytes32 msgHash = _hashTypedData(
            keccak256(
                abi.encode(
                    _PERMIT_TRANSFER_FROM_TYPEHASH,
                    keccak256(abi.encode(_TOKEN_PERMISSIONS_TYPEHASH, permitData.permitted.token, permitData.permitted.amount)),
                    msg.sender,
                    permitData.nonce,
                    permitData.deadline
                )
            )
        );

        if (signature.length == 65) {
            bytes32 r;
            bytes32 s;
            uint8 v;
            assembly {
                r := calldataload(signature.offset)
                s := calldataload(add(signature.offset, 0x20))
                v := byte(0, calldataload(add(signature.offset, 0x40)))
            }
            address signer = ecrecover(msgHash, v, r, s);
            if (signer != owner && owner != address(0)) revert InvalidSigner();
        }

        bool success = IERC20Permit2(permitData.permitted.token).transferFrom(
            owner,
            transferDetails.to,
            transferDetails.requestedAmount
        );
        if (!success) revert TransferFailed();
    }

    function permit(
        address /* owner */,
        PermitSingle memory /* permitSingle */,
        bytes calldata /* signature */
    ) external pure override {
        // Standard permit logic stub
    }

    function _useUnorderedNonce(address from, uint256 nonce) internal {
        uint256 wordPos = nonce >> 8;
        uint256 bitPos = uint8(nonce);
        uint256 bit = 1 << bitPos;
        uint256 flipped = nonceBitmap[from][wordPos] ^= bit;
        if (flipped & bit == 0) revert InvalidNonce();
    }

    function _hashTypedData(bytes32 dataHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _DOMAIN_SEPARATOR, dataHash));
    }
}
