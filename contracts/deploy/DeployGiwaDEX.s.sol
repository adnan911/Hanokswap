// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../core/GiwaPoolFactory.sol";
import "../core/GiwaCLDeployer.sol";
import "../core/GiwaStableDeployer.sol";
import "../periphery/GiwaUniversalRouter.sol";
import "../governance/ProtocolFeeVault.sol";

interface ScriptBase {
    // Standard Foundry script interface placeholder
}

/// @title DeployGiwaDEX
/// @notice Production Deployment Script for Giwa DEX Protocol on Giwa Sepolia (Chain ID: 91342).
contract DeployGiwaDEX {
    uint256 public constant GIWA_SEPOLIA_CHAIN_ID = 91342;
    address public constant WETH9 = 0x4200000000000000000000000000000000000006;
    address public constant USDC = 0x3600000000000000000000000000000000000000;
    address public constant EURC = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;

    event DeploymentSummary(
        address indexed feeVault,
        address indexed factory,
        address indexed router,
        address wethUsdcPool,
        address usdcEurcPool
    );

    function run(address treasury) external returns (
        address feeVaultAddr,
        address factoryAddr,
        address routerAddr,
        address wethUsdcPool,
        address usdcEurcPool
    ) {
        require(block.chainid == GIWA_SEPOLIA_CHAIN_ID || block.chainid == 31337, "Deploy: WRONG_NETWORK");
        require(treasury != address(0), "Deploy: ZERO_TREASURY");

        // 1. Deploy Protocol Fee Vault (70% LP / 20% POL / 10% Burn)
        ProtocolFeeVault feeVault = new ProtocolFeeVault(treasury);
        feeVaultAddr = address(feeVault);

        // 2. Deploy Dedicated Pool Deployers
        GiwaCLDeployer clDeployer = new GiwaCLDeployer();
        GiwaStableDeployer stableDeployer = new GiwaStableDeployer();

        // 3. Deploy Giwa Pool Factory
        GiwaPoolFactory factory = new GiwaPoolFactory(feeVaultAddr, address(clDeployer), address(stableDeployer));
        factoryAddr = address(factory);

        // Authorize factory in deployers
        clDeployer.setFactory(factoryAddr);
        stableDeployer.setFactory(factoryAddr);

        // 4. Deploy Giwa Universal Router
        GiwaUniversalRouter router = new GiwaUniversalRouter(factoryAddr, WETH9);
        routerAddr = address(router);

        // 5. Deploy Genesis Liquidity Pools
        // 5a. WETH / USDC Volatile Pair (0.30% fee CLAMM)
        wethUsdcPool = factory.createPool(WETH9, USDC, 3000, false);

        // 5b. USDC / EURC Pegged Pair (0.01% fee Stableswap)
        usdcEurcPool = factory.createPool(USDC, EURC, 100, true);

        emit DeploymentSummary(feeVaultAddr, factoryAddr, routerAddr, wethUsdcPool, usdcEurcPool);
    }
}
