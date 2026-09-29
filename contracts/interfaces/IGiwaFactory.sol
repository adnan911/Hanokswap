// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IGiwaFactory
/// @notice Interface for Giwa DEX Factory contract managing pool deployments and fee configurations.
interface IGiwaFactory {
    event PoolCreated(
        address indexed token0,
        address indexed token1,
        bool indexed isStable,
        uint256 feeBps,
        address pool,
        uint256 allPoolsLength
    );
    event FeeVaultUpdated(address indexed newFeeVault);
    event FeeTierSet(uint256 feeBps, bool enabled);

    function getPool(address tokenA, address tokenB, bool isStable) external view returns (address pool);
    function allPools(uint256 index) external view returns (address pool);
    function allPoolsLength() external view returns (uint256);
    function feeVault() external view returns (address);
    function isFeeTierEnabled(uint256 feeBps) external view returns (bool);

    function createPool(address tokenA, address tokenB, bool isStable, uint256 feeBps) external returns (address pool);
    function setFeeVault(address newFeeVault) external;
    function enableFeeTier(uint256 feeBps) external;
}
