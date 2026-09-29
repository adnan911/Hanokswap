// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IGiwaFactory.sol";
import "./GiwaPool.sol";

/// @title GiwaFactory
/// @notice Deploys and catalogs Giwa DEX liquidity pools with customizable fee tiers.
contract GiwaFactory is IGiwaFactory {
    address public owner;
    address public feeVault;

    mapping(address => mapping(address => mapping(bool => address))) public getPool;
    address[] public allPools;
    mapping(uint256 => bool) public isFeeTierEnabled;

    modifier onlyOwner() {
        require(msg.sender == owner, "GiwaFactory: FORBIDDEN");
        _;
    }

    constructor(address _feeVault) {
        owner = msg.sender;
        feeVault = _feeVault;

        // Initialize standard fee tiers (in basis points)
        isFeeTierEnabled[1] = true;   // 0.01% - Pegged Stablecoins
        isFeeTierEnabled[5] = true;   // 0.05% - Correlated Assets
        isFeeTierEnabled[30] = true;  // 0.30% - Standard Volatile Pairs
        isFeeTierEnabled[100] = true; // 1.00% - Exotic / Long-tail Tokens
    }

    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }

    function createPool(
        address tokenA,
        address tokenB,
        bool isStable,
        uint256 feeBps
    ) external returns (address pool) {
        require(tokenA != tokenB, "GiwaFactory: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "GiwaFactory: ZERO_ADDRESS");
        require(getPool[token0][token1][isStable] == address(0), "GiwaFactory: POOL_EXISTS");
        require(isFeeTierEnabled[feeBps], "GiwaFactory: FEE_TIER_NOT_ENABLED");

        bytes32 salt = keccak256(abi.encodePacked(token0, token1, isStable, feeBps));
        GiwaPool newPool = new GiwaPool{salt: salt}(token0, token1, isStable, feeBps);
        pool = address(newPool);

        getPool[token0][token1][isStable] = pool;
        getPool[token1][token0][isStable] = pool;
        allPools.push(pool);

        emit PoolCreated(token0, token1, isStable, feeBps, pool, allPools.length);
    }

    function setFeeVault(address newFeeVault) external onlyOwner {
        require(newFeeVault != address(0), "GiwaFactory: ZERO_ADDRESS");
        feeVault = newFeeVault;
        emit FeeVaultUpdated(newFeeVault);
    }

    function enableFeeTier(uint256 feeBps) external onlyOwner {
        require(feeBps > 0 && feeBps <= 1000, "GiwaFactory: INVALID_FEE"); // Max 10%
        isFeeTierEnabled[feeBps] = true;
        emit FeeTierSet(feeBps, true);
    }

    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "GiwaFactory: ZERO_ADDRESS");
        owner = newOwner;
    }
}
