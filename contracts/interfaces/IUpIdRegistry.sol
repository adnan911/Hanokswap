// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IUpIdRegistry
/// @notice Interface for Dunamu's up.id (Upbit Web3 Name Service) registry on Giwa Chain.
interface IUpIdRegistry {
    event NameRegistered(string indexed name, address indexed owner, address indexed target);
    event NameTransferred(string indexed name, address indexed oldOwner, address indexed newOwner);
    event PrimaryNameSet(address indexed user, string name);
    event AddressUpdated(string indexed name, address indexed newTarget);

    function register(string calldata name, address target) external returns (bytes32);
    function setPrimaryName(string calldata name) external;
    function resolveName(string calldata name) external view returns (address);
    function resolveAddress(address addr) external view returns (string memory);
    function isAvailable(string calldata name) external view returns (bool);
}
