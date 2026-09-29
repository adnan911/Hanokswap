const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;

  console.log("=================================================");
  console.log("🚀 Giwa DEX Hardhat Deployment to Giwa Sepolia");
  console.log("=================================================");
  console.log("Deployer:", deployer.address);
  console.log("Treasury:", treasuryAddress);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Gas Balance: ${ethers.formatEther(balance)} ETH`);
  console.log("=================================================\n");

  if (balance === 0n) {
    console.warn("⚠️ Warning: Deployer has 0 ETH. Please request testnet ETH from https://faucet.giwa.io");
    return;
  }

  // 1. Deploy ProtocolFeeVault
  console.log("1. Deploying ProtocolFeeVault...");
  const FeeVaultFactory = await ethers.getContractFactory("ProtocolFeeVault");
  const feeVault = await FeeVaultFactory.deploy(treasuryAddress);
  await feeVault.waitForDeployment();
  const feeVaultAddress = await feeVault.getAddress();
  console.log("✅ ProtocolFeeVault deployed to:", feeVaultAddress);

  // 2. Deploy GiwaPoolFactory
  console.log("2. Deploying GiwaPoolFactory...");
  const PoolFactory = await ethers.getContractFactory("GiwaPoolFactory");
  const factory = await PoolFactory.deploy(feeVaultAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ GiwaPoolFactory deployed to:", factoryAddress);

  // 3. Deploy GiwaUniversalRouter
  const WETH9 = "0x4200000000000000000000000000000000000006";
  console.log("3. Deploying GiwaUniversalRouter...");
  const RouterFactory = await ethers.getContractFactory("GiwaUniversalRouter");
  const router = await RouterFactory.deploy(factoryAddress, WETH9);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("✅ GiwaUniversalRouter deployed to:", routerAddress);

  // 4. Create Genesis Liquidity Pools
  const USDC = "0x3600000000000000000000000000000000000000";
  const EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

  console.log("4. Creating Genesis Pools...");
  const tx1 = await factory.createPool(WETH9, USDC, 3000, false);
  await tx1.wait();
  console.log("✅ WETH/USDC Volatile CLAMM Pool Created!");

  const tx2 = await factory.createPool(USDC, EURC, 100, true);
  await tx2.wait();
  console.log("✅ USDC/EURC Stableswap Curve Pool Created!");

  console.log("\n=================================================");
  console.log("🎉 ALL CONTRACTS DEPLOYED SUCCESSFULLY ON GIWA!");
  console.log("=================================================");
  console.log("ProtocolFeeVault:    ", feeVaultAddress);
  console.log("GiwaPoolFactory:     ", factoryAddress);
  console.log("GiwaUniversalRouter: ", routerAddress);
  console.log("Explorer URL:         https://sepolia-explorer.giwa.io");
  console.log("=================================================");
}

main().catch((error) => {
  console.error("Hardhat deployment error:", error);
  process.exitCode = 1;
});
