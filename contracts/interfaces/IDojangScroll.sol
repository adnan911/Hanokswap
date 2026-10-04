// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IDojangScroll
/// @notice Interface for Dunamu's Dojang Attestation Ledger (giwa-io/dojang) on Giwa Chain.
interface IDojangScroll {
    function getAttestationUIDByAttester(address recipient, bytes32 schema, address attester) external view returns (bytes32);
    struct Attestation {
        bytes32 uid;
        bytes32 schema;
        uint64 time;
        uint64 expirationTime;
        uint64 revocationTime;
        bytes32 refUID;
        address recipient;
        address attester;
        bool revocable;
        bytes data;
    }

    struct AttestationRequestData {
        address recipient;
        uint64 expirationTime;
        bool revocable;
        bytes32 refUID;
        bytes data;
        uint256 value;
    }

    struct AttestationRequest {
        bytes32 schema;
        AttestationRequestData data;
    }

    event Attested(address indexed recipient, address indexed attester, bytes32 indexed uid, bytes32 schema);
    event Revoked(address indexed recipient, address indexed attester, bytes32 indexed uid, bytes32 schema);

    function attest(AttestationRequest calldata request) external payable returns (bytes32);
    function revoke(bytes32 uid) external;
    function getAttestation(bytes32 uid) external view returns (Attestation memory);
    function isAttestationValid(bytes32 uid) external view returns (bool);
    function hasValidAttestation(address recipient, bytes32 schema, address trustedAttester) external view returns (bool);
}
