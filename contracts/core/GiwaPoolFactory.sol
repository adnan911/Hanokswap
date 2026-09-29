// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IGiwaPoolFactory.sol";
import "../interfaces/IGiwaPoolDeployer.sol";

/// @title GiwaPoolFactory
/// @notice Core Factory contract for deploying Concentrated Liquidity (CLAMM) and Stableswap pools on Giwa Chain.
contract GiwaPoolFactory is IGiwaPoolFactory {
    address public override owner;
    address public override feeVault;
    address public clDeployer;
    address public stableDeployer;

    mapping(uint24 => int24) public override feeAmountTickSpacing;
    mapping(address => mapping(address => mapping(uint24 => mapping(bool => address)))) public getPoolMapping;
    address[] public override allPools;

    modifier onlyOwner() {
        require(msg.sender == owner, "GiwaPoolFactory: FORBIDDEN");
        _;
    }

    constructor(address _feeVault, address _clDeployer, address _stableDeployer) {
        require(_feeVault != address(0), "GiwaPoolFactory: ZERO_ADDRESS");
        require(_clDeployer != address(0), "GiwaPoolFactory: ZERO_ADDRESS");
        require(_stableDeployer != address(0), "GiwaPoolFactory: ZERO_ADDRESS");
        owner = msg.sender;
        feeVault = _feeVault;
        clDeployer = _clDeployer;
        stableDeployer = _stableDeployer;

        // Initialize standard fee tiers and tick spacings (Uniswap v3 / Giwa CLAMM standard)
        _enableFeeAmount(100, 1);    // 0.01% - Tick spacing 1 (Pegged/Stable pairs)
        _enableFeeAmount(500, 10);   // 0.05% - Tick spacing 10 (Correlated assets)
        _enableFeeAmount(3000, 60);  // 0.30% - Tick spacing 60 (Standard volatile pairs)
        _enableFeeAmount(10000, 200);// 1.00% - Tick spacing 200 (Exotic pairs)
    }

    function allPoolsLength() external view override returns (uint256) {
        return allPools.length;
    }

    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee,
        bool isStable
    ) external view override returns (address) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        return getPoolMapping[token0][token1][fee][isStable];
    }

    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee,
        bool isStable
    ) external override returns (address pool) {
        require(tokenA != tokenB, "GiwaPoolFactory: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "GiwaPoolFactory: ZERO_ADDRESS");
        require(getPoolMapping[token0][token1][fee][isStable] == address(0), "GiwaPoolFactory: POOL_EXISTS");

        int24 tickSpacing = feeAmountTickSpacing[fee];
        require(tickSpacing != 0, "GiwaPoolFactory: FEE_NOT_ENABLED");

        bytes32 salt = keccak256(abi.encodePacked(token0, token1, fee, isStable));

        if (isStable) {
            pool = IGiwaStableDeployer(stableDeployer).deployStablePool(salt, token0, token1, fee, feeVault);
        } else {
            pool = IGiwaCLDeployer(clDeployer).deployCLPool(salt, token0, token1, fee, tickSpacing, feeVault);
        }

        getPoolMapping[token0][token1][fee][isStable] = pool;
        getPoolMapping[token1][token0][fee][isStable] = pool;
        allPools.push(pool);

        emit PoolCreated(token0, token1, fee, tickSpacing, isStable, pool);
    }

    function enableFeeAmount(uint24 fee, int24 tickSpacing) external override onlyOwner {
        _enableFeeAmount(fee, tickSpacing);
    }

    function _enableFeeAmount(uint24 fee, int24 tickSpacing) private {
        require(fee < 1000000, "GiwaPoolFactory: FEE_TOO_HIGH");
        require(tickSpacing > 0 && tickSpacing <= 16384, "GiwaPoolFactory: INVALID_TICK_SPACING");
        require(feeAmountTickSpacing[fee] == 0, "GiwaPoolFactory: FEE_ALREADY_ENABLED");

        feeAmountTickSpacing[fee] = tickSpacing;
        emit FeeAmountEnabled(fee, tickSpacing);
    }

    function setFeeVault(address _feeVault) external override onlyOwner {
        require(_feeVault != address(0), "GiwaPoolFactory: ZERO_ADDRESS");
        feeVault = _feeVault;
        emit FeeVaultSet(_feeVault);
    }

    function setOwner(address _newOwner) external override onlyOwner {
        require(_newOwner != address(0), "GiwaPoolFactory: ZERO_ADDRESS");
        emit OwnerChanged(owner, _newOwner);
        owner = _newOwner;
    }
}
