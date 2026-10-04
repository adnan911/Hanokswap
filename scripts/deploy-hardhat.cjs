const ethers = require('../test/support/ethers.cjs');
const hre = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;
  let WETH9 = '0x4200000000000000000000000000000000000006';
  let USDC = process.env.GIWA_USDC_ADDRESS || '0x3600000000000000000000000000000000000000';
  let EURC = process.env.GIWA_EURC_ADDRESS || '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a';
  if (hre.network.name === 'hardhat') {
    WETH9 = await (await (await ethers.getContractFactory('MockWETH')).deploy()).getAddress();
    USDC = await (await (await ethers.getContractFactory('MockERC20')).deploy('Test USD', 'tUSD')).getAddress();
    EURC = await (await (await ethers.getContractFactory('MockERC20')).deploy('Test EUR', 'tEUR')).getAddress();
  }
  for (const token of [WETH9, USDC, EURC]) {
    if (await ethers.provider.getCode(token) === '0x') throw new Error(`Token ${token} is not deployed. Set GIWA_USDC_ADDRESS / GIWA_EURC_ADDRESS to verified test-token deployments.`);
  }

  console.log("=================================================");
  console.log(`Giwa DEX deployment on ${hre.network.name}`);
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

  const clDeployer = await (await ethers.getContractFactory('GiwaCLDeployer')).deploy();
  await clDeployer.waitForDeployment();
  const stableDeployer = await (await ethers.getContractFactory('GiwaStableDeployer')).deploy();
  await stableDeployer.waitForDeployment();

  // 2. Deploy GiwaPoolFactory
  console.log("2. Deploying GiwaPoolFactory...");
  const PoolFactory = await ethers.getContractFactory("GiwaPoolFactory");
  const factory = await PoolFactory.deploy(feeVaultAddress, await clDeployer.getAddress(), await stableDeployer.getAddress());
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ GiwaPoolFactory deployed to:", factoryAddress);
  await (await clDeployer.setFactory(factoryAddress)).wait();
  await (await stableDeployer.setFactory(factoryAddress)).wait();

  // 3. Deploy GiwaUniversalRouter
  console.log("3. Deploying GiwaUniversalRouter...");
  const RouterFactory = await ethers.getContractFactory("GiwaUniversalRouter");
  const router = await RouterFactory.deploy(factoryAddress, WETH9, '0x000000000022D473030F116dDEE9F6B43aC78BA3');
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("✅ GiwaUniversalRouter deployed to:", routerAddress);

  // 4. Create Genesis Liquidity Pools

  console.log("4. Creating Genesis Pools...");
  const tx1 = await factory.createPool(WETH9, USDC, 3000, false);
  await tx1.wait();
  console.log("✅ WETH/USDC Volatile CLAMM Pool Created!");

  const tx2 = await factory.createPool(USDC, EURC, 100, true);
  await tx2.wait();
  console.log("✅ USDC/EURC Stableswap Curve Pool Created!");

  console.log("\n=================================================");
  console.log(`Contracts deployed on ${hre.network.name}; pools are created but not funded.`);
  console.log("=================================================");
  console.log("ProtocolFeeVault:    ", feeVaultAddress);
  console.log("GiwaPoolFactory:     ", factoryAddress);
  console.log("GiwaUniversalRouter: ", routerAddress);
  console.log("Explorer URL:         https://sepolia-explorer.giwa.io");
  console.log("=================================================");
}

module.exports = { main };
if (require.main === module) main().catch((error) => {
  console.error("Hardhat deployment error:", error);
  process.exitCode = 1;
});
