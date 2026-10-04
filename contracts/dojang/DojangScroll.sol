// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IDojangScroll.sol";
import "../interfaces/ISchemaBook.sol";

/// @title DojangScroll
/// @notice Core EAS-compatible Attestation Ledger for Giwa Chain (giwa-io/dojang).
contract DojangScroll is IDojangScroll {
    ISchemaBook public immutable schemaBook;
    mapping(bytes32 => Attestation) private _db;
    mapping(address => mapping(bytes32 => bytes32)) private _latestUserAttestation; // recipient => schema => uid
    mapping(address => mapping(bytes32 => mapping(address => bytes32))) private _latestByAttester;
    uint256 private _attestationCount;

    error InvalidSchema();
    error AccessDenied();
    error Irrevocable();
    error Expired();
    error NotFound();

    constructor(address _schemaBook) {
        require(_schemaBook != address(0), "DojangScroll: ZERO_SCHEMA_BOOK");
        schemaBook = ISchemaBook(_schemaBook);
    }

    function attest(AttestationRequest calldata request) external payable override returns (bytes32) {
        ISchemaBook.SchemaRecord memory schemaRecord = schemaBook.getSchema(request.schema);
        if (schemaRecord.uid == bytes32(0)) revert InvalidSchema();

        bytes32 uid = keccak256(
            abi.encodePacked(
                request.schema,
                request.data.recipient,
                msg.sender,
                block.timestamp,
                request.data.expirationTime,
                request.data.revocable,
                request.data.refUID,
                request.data.data,
                _attestationCount
            )
        );

        _db[uid] = Attestation({
            uid: uid,
            schema: request.schema,
            time: uint64(block.timestamp),
            expirationTime: request.data.expirationTime,
            revocationTime: 0,
            refUID: request.data.refUID,
            recipient: request.data.recipient,
            attester: msg.sender,
            revocable: request.data.revocable,
            data: request.data.data
        });

        _latestUserAttestation[request.data.recipient][request.schema] = uid;
        _latestByAttester[request.data.recipient][request.schema][msg.sender] = uid;
        _attestationCount++;

        emit Attested(request.data.recipient, msg.sender, uid, request.schema);
        return uid;
    }

    function revoke(bytes32 uid) external override {
        Attestation storage att = _db[uid];
        if (att.uid == bytes32(0)) revert NotFound();
        if (att.attester != msg.sender) revert AccessDenied();
        if (!att.revocable) revert Irrevocable();
        if (att.revocationTime != 0) return;

        att.revocationTime = uint64(block.timestamp);
        emit Revoked(att.recipient, msg.sender, uid, att.schema);
    }

    function getAttestation(bytes32 uid) external view override returns (Attestation memory) {
        return _db[uid];
    }

    function isAttestationValid(bytes32 uid) public view override returns (bool) {
        Attestation memory att = _db[uid];
        if (att.uid == bytes32(0)) return false;
        if (att.revocationTime != 0) return false;
        if (att.expirationTime != 0 && att.expirationTime <= block.timestamp) return false;
        return true;
    }

    function hasValidAttestation(
        address recipient,
        bytes32 schema,
        address trustedAttester
    ) external view override returns (bool) {
        bytes32 uid = trustedAttester == address(0)
            ? _latestUserAttestation[recipient][schema]
            : _latestByAttester[recipient][schema][trustedAttester];
        if (uid == bytes32(0)) return false;

        Attestation memory att = _db[uid];
        if (att.attester != trustedAttester && trustedAttester != address(0)) return false;
        return isAttestationValid(uid);
    }

    function getLatestAttestationUID(address recipient, bytes32 schema) external view returns (bytes32) {
        return _latestUserAttestation[recipient][schema];
    }

    function getAttestationUIDByAttester(address recipient, bytes32 schema, address attester) external view override returns (bytes32) {
        return _latestByAttester[recipient][schema][attester];
    }

    function attestationCount() external view returns (uint256) {
        return _attestationCount;
    }
}
