// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IGiwaCLDeployer
/// @notice Deployer interface for Concentrated Liquidity Pools
interface IGiwaCLDeployer {
    function deployCLPool(
        bytes32 salt,
        address token0,
        address token1,
        uint24 fee,
        int24 tickSpacing,
        address feeVault
    ) external returns (address pool);
}

/// @title IGiwaStableDeployer
/// @notice Deployer interface for Stableswap Invariant Pools
interface IGiwaStableDeployer {
    function deployStablePool(
        bytes32 salt,
        address token0,
        address token1,
        uint24 fee,
        address feeVault
    ) external returns (address pool);
}
