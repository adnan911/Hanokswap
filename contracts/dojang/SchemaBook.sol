// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/ISchemaBook.sol";

/// @title SchemaBook
/// @notice Dunamu Dojang Schema Registry implementing standard EAS Schema specifications on Giwa Chain.
contract SchemaBook is ISchemaBook {
    mapping(bytes32 => SchemaRecord) private _schemas;
    bytes32[] private _allSchemaUIDs;

    error SchemaAlreadyExists();
    error EmptySchema();

    function register(
        string calldata schema,
        address resolver,
        bool revocable
    ) external override returns (bytes32) {
        if (bytes(schema).length == 0) revert EmptySchema();

        bytes32 uid = keccak256(abi.encodePacked(schema, resolver, revocable));
        if (_schemas[uid].uid != bytes32(0)) revert SchemaAlreadyExists();

        _schemas[uid] = SchemaRecord({
            uid: uid,
            resolver: resolver,
            revocable: revocable,
            schema: schema
        });
        _allSchemaUIDs.push(uid);

        emit SchemaRegistered(uid, msg.sender);
        return uid;
    }

    function getSchema(bytes32 uid) external view override returns (SchemaRecord memory) {
        return _schemas[uid];
    }

    function schemaCount() external view returns (uint256) {
        return _allSchemaUIDs.length;
    }

    function getSchemaUIDByIndex(uint256 index) external view returns (bytes32) {
        require(index < _allSchemaUIDs.length, "Index out of bounds");
        return _allSchemaUIDs[index];
    }
}
