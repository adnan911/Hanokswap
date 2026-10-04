// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISchemaBook
/// @notice Interface for Dunamu's SchemaBook (Schema Registry) on Giwa Chain.
interface ISchemaBook {
    struct SchemaRecord {
        bytes32 uid;
        address resolver;
        bool revocable;
        string schema;
    }

    event SchemaRegistered(bytes32 indexed uid, address indexed registerer);

    function register(string calldata schema, address resolver, bool revocable) external returns (bytes32);
    function getSchema(bytes32 uid) external view returns (SchemaRecord memory);
}
