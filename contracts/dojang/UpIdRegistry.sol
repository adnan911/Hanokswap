// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IUpIdRegistry.sol";

/// @title UpIdRegistry
/// @notice Dunamu's up.id Web3 Name Service registry for Giwa Chain.
contract UpIdRegistry is IUpIdRegistry {
    address public owner;
    
    // nameHash => target address
    mapping(bytes32 => address) private _nameToAddress;
    // nameHash => string raw name
    mapping(bytes32 => string) private _nameHashToName;
    // address => primary name string
    mapping(address => string) private _addressToPrimaryName;
    // nameHash => owner address
    mapping(bytes32 => address) private _nameOwners;

    error NameAlreadyTaken();
    error InvalidName();
    error Unauthorized();
    error ZeroAddress();

    modifier onlyOwner() {
        require(msg.sender == owner, "UpIdRegistry: NOT_OWNER");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function _hashName(string memory name) internal pure returns (bytes32) {
        bytes memory b = bytes(name);
        bytes memory lower = new bytes(b.length);
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 char = b[i];
            if (char >= 0x41 && char <= 0x5A) {
                lower[i] = bytes1(uint8(char) + 32); // lowercase
            } else {
                lower[i] = char;
            }
        }
        return keccak256(lower);
    }

    function register(string calldata name, address target) external override returns (bytes32) {
        if (bytes(name).length < 2) revert InvalidName();
        if (target == address(0)) revert ZeroAddress();

        bytes32 nameHash = _hashName(name);
        if (_nameToAddress[nameHash] != address(0)) revert NameAlreadyTaken();

        _nameToAddress[nameHash] = target;
        _nameHashToName[nameHash] = name;
        _nameOwners[nameHash] = msg.sender;

        // If target doesn't have a primary name, automatically set it
        if (bytes(_addressToPrimaryName[target]).length == 0) {
            _addressToPrimaryName[target] = name;
            emit PrimaryNameSet(target, name);
        }

        emit NameRegistered(name, msg.sender, target);
        return nameHash;
    }

    function setPrimaryName(string calldata name) external override {
        bytes32 nameHash = _hashName(name);
        if (_nameToAddress[nameHash] != msg.sender && _nameOwners[nameHash] != msg.sender) {
            revert Unauthorized();
        }

        _addressToPrimaryName[msg.sender] = name;
        emit PrimaryNameSet(msg.sender, name);
    }

    function updateTarget(string calldata name, address newTarget) external {
        bytes32 nameHash = _hashName(name);
        if (_nameOwners[nameHash] != msg.sender) revert Unauthorized();
        if (newTarget == address(0)) revert ZeroAddress();

        _nameToAddress[nameHash] = newTarget;
        emit AddressUpdated(name, newTarget);
    }

    function resolveName(string calldata name) external view override returns (address) {
        return _nameToAddress[_hashName(name)];
    }

    function resolveAddress(address addr) external view override returns (string memory) {
        return _addressToPrimaryName[addr];
    }

    function isAvailable(string calldata name) external view override returns (bool) {
        return _nameToAddress[_hashName(name)] == address(0);
    }

    function getNameOwner(string calldata name) external view returns (address) {
        return _nameOwners[_hashName(name)];
    }
}
