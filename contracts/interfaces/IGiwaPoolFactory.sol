// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IGiwaPoolFactory
/// @notice Comprehensive Factory Interface for Giwa DEX deploying Concentrated Liquidity and Stableswap Pools.
interface IGiwaPoolFactory {
    event PoolCreated(
        address indexed token0,
        address indexed token1,
        uint24 indexed fee,
        int24 tickSpacing,
        bool isStable,
        address pool
    );
    event FeeAmountEnabled(uint24 indexed fee, int24 indexed tickSpacing);
    event FeeVaultSet(address indexed feeVault);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    function owner() external view returns (address);
    function feeVault() external view returns (address);
    function feeAmountTickSpacing(uint24 fee) external view returns (int24);
    function getPool(address tokenA, address tokenB, uint24 fee, bool isStable) external view returns (address pool);
    function allPools(uint256 index) external view returns (address pool);
    function allPoolsLength() external view returns (uint256);

    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee,
        bool isStable
    ) external returns (address pool);

    function enableFeeAmount(uint24 fee, int24 tickSpacing) external;
    function setFeeVault(address _feeVault) external;
    function setOwner(address _owner) external;
}
