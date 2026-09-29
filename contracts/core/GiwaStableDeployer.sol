// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./GiwaStablePool.sol";
import "../interfaces/IGiwaPoolDeployer.sol";

/// @title GiwaStableDeployer
/// @notice Dedicated deployer contract for Stableswap Curve Invariant Pools
contract GiwaStableDeployer is IGiwaStableDeployer {
    address public factory;
    address public owner;

    event FactorySet(address indexed factory);

    constructor() {
        owner = msg.sender;
    }

    function setFactory(address _factory) external {
        require(msg.sender == owner, "GiwaStableDeployer: FORBIDDEN");
        require(factory == address(0), "GiwaStableDeployer: ALREADY_SET");
        require(_factory != address(0), "GiwaStableDeployer: ZERO_ADDRESS");
        factory = _factory;
        emit FactorySet(_factory);
    }

    function deployStablePool(
        bytes32 salt,
        address token0,
        address token1,
        uint24 fee,
        address feeVault
    ) external override returns (address pool) {
        require(msg.sender == factory, "GiwaStableDeployer: FORBIDDEN");
        pool = address(new GiwaStablePool{salt: salt}(token0, token1, fee, feeVault));
    }
}
