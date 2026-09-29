// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./GiwaCLPool.sol";
import "../interfaces/IGiwaPoolDeployer.sol";

/// @title GiwaCLDeployer
/// @notice Dedicated deployer contract for Concentrated Liquidity Pools (CLAMM)
contract GiwaCLDeployer is IGiwaCLDeployer {
    address public factory;
    address public owner;

    event FactorySet(address indexed factory);

    constructor() {
        owner = msg.sender;
    }

    function setFactory(address _factory) external {
        require(msg.sender == owner, "GiwaCLDeployer: FORBIDDEN");
        require(factory == address(0), "GiwaCLDeployer: ALREADY_SET");
        require(_factory != address(0), "GiwaCLDeployer: ZERO_ADDRESS");
        factory = _factory;
        emit FactorySet(_factory);
    }

    function deployCLPool(
        bytes32 salt,
        address token0,
        address token1,
        uint24 fee,
        int24 tickSpacing,
        address feeVault
    ) external override returns (address pool) {
        require(msg.sender == factory, "GiwaCLDeployer: FORBIDDEN");
        pool = address(new GiwaCLPool{salt: salt}(token0, token1, fee, tickSpacing, feeVault));
    }
}
