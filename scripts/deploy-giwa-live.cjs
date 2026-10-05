const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function loadArtifact(relativePath) {
  const fullPath = path.join(process.cwd(), 'artifacts', relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Artifact not found at ${fullPath}. Run npx hardhat compile first.`);
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
}

async function main() {
  const rpcUrl = process.env.GIWA_RPC_URL || 'https://sepolia-rpc.giwa.io';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('❌ DEPLOYER_PRIVATE_KEY or PRIVATE_KEY not found in .env');
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  const treasuryAddress = process.env.TREASURY_ADDRESS || wallet.address;
  const WETH9 = '0x4200000000000000000000000000000000000006';
  const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

  console.log('=================================================');
  console.log('🚀 Deploying HanokSwap to GIWA Sepolia');
  console.log('=================================================');
  console.log('RPC Endpoint: ', rpcUrl);
  console.log('Deployer:     ', wallet.address);
  console.log('Treasury:     ', treasuryAddress);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Gas Balance:   ${ethers.formatEther(balance)} ETH`);
  console.log('=================================================\n');

  if (balance === 0n) {
    throw new Error('❌ Deployer balance is 0 ETH. Fund account on GIWA Sepolia first.');
  }

  // Load Artifacts
  const testnetERC20Artifact = loadArtifact('contracts/test/TestnetERC20.sol/TestnetERC20.json');
  const feeVaultArtifact = loadArtifact('contracts/governance/ProtocolFeeVault.sol/ProtocolFeeVault.json');
  const clDeployerArtifact = loadArtifact('contracts/core/GiwaCLDeployer.sol/GiwaCLDeployer.json');
  const stableDeployerArtifact = loadArtifact('contracts/core/GiwaStableDeployer.sol/GiwaStableDeployer.json');
  const factoryArtifact = loadArtifact('contracts/core/GiwaPoolFactory.sol/GiwaPoolFactory.json');
  const routerArtifact = loadArtifact('contracts/periphery/GiwaUniversalRouter.sol/GiwaUniversalRouter.json');
  const clPoolArtifact = loadArtifact('contracts/core/GiwaCLPool.sol/GiwaCLPool.json');
  const stablePoolArtifact = loadArtifact('contracts/core/GiwaStablePool.sol/GiwaStablePool.json');

  // 1. Deploy Testnet Mock Tokens
  console.log('1. 📦 Deploying Testnet Tokens...');
  const ERC20Factory = new ethers.ContractFactory(testnetERC20Artifact.abi, testnetERC20Artifact.bytecode, wallet);

  console.log('   Deploying USDC...');
  const usdc = await ERC20Factory.deploy('USD Coin (Testnet)', 'USDC', 6);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log('   ✅ Mock USDC deployed at:', usdcAddress);

  console.log('   Deploying EURC...');
  const eurc = await ERC20Factory.deploy('Euro Coin (Testnet)', 'EURC', 6);
  await eurc.waitForDeployment();
  const eurcAddress = await eurc.getAddress();
  console.log('   ✅ Mock EURC deployed at:', eurcAddress);

  console.log('   Deploying KRWC...');
  const krwc = await ERC20Factory.deploy('Korean Won Coin (Testnet)', 'KRWC', 6);
  await krwc.waitForDeployment();
  const krwcAddress = await krwc.getAddress();
  console.log('   ✅ Mock KRWC deployed at:', krwcAddress);

  console.log('   Deploying USYC...');
  const usyc = await ERC20Factory.deploy('Yield USD (Testnet)', 'USYC', 6);
  await usyc.waitForDeployment();
  const usycAddress = await usyc.getAddress();
  console.log('   ✅ Mock USYC deployed at:', usycAddress);

  // 2. Deploy ProtocolFeeVault
  console.log('\n2. 📦 Deploying ProtocolFeeVault...');
  const feeVaultFactory = new ethers.ContractFactory(feeVaultArtifact.abi, feeVaultArtifact.bytecode, wallet);
  const feeVault = await feeVaultFactory.deploy(treasuryAddress);
  await feeVault.waitForDeployment();
  const feeVaultAddress = await feeVault.getAddress();
  console.log('   ✅ ProtocolFeeVault deployed at:', feeVaultAddress);

  // 3. Deploy Pool Deployers
  console.log('\n3. 📦 Deploying GiwaCLDeployer & GiwaStableDeployer...');
  const clDeployerFactory = new ethers.ContractFactory(clDeployerArtifact.abi, clDeployerArtifact.bytecode, wallet);
  const clDeployer = await clDeployerFactory.deploy();
  await clDeployer.waitForDeployment();
  const clDeployerAddress = await clDeployer.getAddress();
  console.log('   ✅ GiwaCLDeployer deployed at:', clDeployerAddress);

  const stableDeployerFactory = new ethers.ContractFactory(stableDeployerArtifact.abi, stableDeployerArtifact.bytecode, wallet);
  const stableDeployer = await stableDeployerFactory.deploy();
  await stableDeployer.waitForDeployment();
  const stableDeployerAddress = await stableDeployer.getAddress();
  console.log('   ✅ GiwaStableDeployer deployed at:', stableDeployerAddress);

  // 4. Deploy GiwaPoolFactory
  console.log('\n4. 📦 Deploying GiwaPoolFactory...');
  const poolFactoryFactory = new ethers.ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, wallet);
  const factory = await poolFactoryFactory.deploy(feeVaultAddress, clDeployerAddress, stableDeployerAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log('   ✅ GiwaPoolFactory deployed at:', factoryAddress);

  // 5. Authorize Factory in Deployers
  console.log('\n5. 🔐 Authorizing Factory in Deployers...');
  const txSetCl = await clDeployer.setFactory(factoryAddress);
  await txSetCl.wait();
  const txSetStable = await stableDeployer.setFactory(factoryAddress);
  await txSetStable.wait();
  console.log('   ✅ Factory authorized in Deployers!');

  // 6. Deploy GiwaUniversalRouter
  console.log('\n6. 📦 Deploying GiwaUniversalRouter...');
  const routerFactory = new ethers.ContractFactory(routerArtifact.abi, routerArtifact.bytecode, wallet);
  const router = await routerFactory.deploy(factoryAddress, WETH9, PERMIT2);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log('   ✅ GiwaUniversalRouter deployed at:', routerAddress);

  // 7. Create Genesis Pools
  console.log('\n7. 🏊 Creating Genesis Pools...');
  
  // WETH / USDC CLAMM Pool (fee = 3000)
  console.log('   Creating WETH / USDC pool...');
  const txPool1 = await factory.createPool(WETH9, usdcAddress, 3000, false);
  await txPool1.wait();
  const poolWethUsdc = await factory.getPool(WETH9, usdcAddress, 3000, false);
  console.log('   ✅ WETH/USDC CLAMM Pool created at:', poolWethUsdc);

  try {
    const clPool = new ethers.Contract(poolWethUsdc, clPoolArtifact.abi, wallet);
    const initTx = await clPool.initialize('79228162514264337593543950336'); // 1:1 price
    await initTx.wait();
    console.log('   ✅ WETH/USDC CLAMM Pool initialized with base price!');
  } catch (err) {
    console.log('   ⚠️ CL pool initialize:', err.message);
  }

  // USDC / EURC Stableswap Pool (fee = 100 = 0.01%)
  console.log('   Creating USDC / EURC pool...');
  const txPool2 = await factory.createPool(usdcAddress, eurcAddress, 100, true);
  await txPool2.wait();
  const poolUsdcEurc = await factory.getPool(usdcAddress, eurcAddress, 100, true);
  console.log('   ✅ USDC/EURC Stableswap Pool created at:', poolUsdcEurc);

  // USDC / KRWC Stableswap Pool (fee = 100 = 0.01%)
  console.log('   Creating USDC / KRWC pool...');
  const txPool3 = await factory.createPool(usdcAddress, krwcAddress, 100, true);
  await txPool3.wait();
  const poolUsdcKrwc = await factory.getPool(usdcAddress, krwcAddress, 100, true);
  console.log('   ✅ USDC/KRWC Stableswap Pool created at:', poolUsdcKrwc);

  // 8. Mint Initial Liquidity & Seed Stableswap Pools
  console.log('\n8. 💧 Minting Test Tokens & Seeding Stableswap Liquidity...');
  const mintAmount = ethers.parseUnits('10000000', 6); // 10,000,000 tokens
  await (await usdc.mint(wallet.address, mintAmount)).wait();
  await (await eurc.mint(wallet.address, mintAmount)).wait();
  await (await krwc.mint(wallet.address, mintAmount)).wait();
  await (await usyc.mint(wallet.address, mintAmount)).wait();
  console.log('   ✅ Minted 10M test tokens to deployer!');

  const seedAmount = ethers.parseUnits('100000', 6); // 100,000 each for pool seeding
  
  // Seed USDC/EURC pool
  const stablePool1 = new ethers.Contract(poolUsdcEurc, stablePoolArtifact.abi, wallet);
  await (await usdc.approve(poolUsdcEurc, seedAmount)).wait();
  await (await eurc.approve(poolUsdcEurc, seedAmount)).wait();
  const seedTx1 = await stablePool1.add_liquidity([seedAmount, seedAmount], 0);
  await seedTx1.wait();
  console.log('   ✅ Seeded USDC/EURC pool with 100,000 USDC + 100,000 EURC!');

  // Seed USDC/KRWC pool
  const stablePool2 = new ethers.Contract(poolUsdcKrwc, stablePoolArtifact.abi, wallet);
  await (await usdc.approve(poolUsdcKrwc, seedAmount)).wait();
  await (await krwc.approve(poolUsdcKrwc, seedAmount)).wait();
  const seedTx2 = await stablePool2.add_liquidity([seedAmount, seedAmount], 0);
  await seedTx2.wait();
  console.log('   ✅ Seeded USDC/KRWC pool with 100,000 USDC + 100,000 KRWC!');

  // 9. Save deployment manifest
  const deploymentManifest = {
    network: 'giwaSepolia',
    chainId: 91342,
    timestamp: new Date().toISOString(),
    deployer: wallet.address,
    treasury: treasuryAddress,
    contracts: {
      WETH: WETH9,
      PERMIT2: PERMIT2,
      USDC: usdcAddress,
      EURC: eurcAddress,
      KRWC: krwcAddress,
      USYC: usycAddress,
      ProtocolFeeVault: feeVaultAddress,
      GiwaCLDeployer: clDeployerAddress,
      GiwaStableDeployer: stableDeployerAddress,
      GiwaPoolFactory: factoryAddress,
      GiwaUniversalRouter: routerAddress,
      Pool_WETH_USDC: poolWethUsdc,
      Pool_USDC_EURC: poolUsdcEurc,
      Pool_USDC_KRWC: poolUsdcKrwc,
    },
  };

  const deploymentsDir = path.join(process.cwd(), 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(deploymentsDir, 'giwa-sepolia.json'),
    JSON.stringify(deploymentManifest, null, 2)
  );
  console.log('\n📄 Deployment manifest saved to deployments/giwa-sepolia.json');

  console.log('\n=================================================');
  console.log('🎉 ALL PROTOCOL CONTRACTS & TOKENS LIVE ON GIWA SEPOLIA!');
  console.log('=================================================');
  console.log('USDC (Testnet):      ', usdcAddress);
  console.log('EURC (Testnet):      ', eurcAddress);
  console.log('KRWC (Testnet):      ', krwcAddress);
  console.log('USYC (Testnet):      ', usycAddress);
  console.log('GiwaPoolFactory:     ', factoryAddress);
  console.log('GiwaUniversalRouter: ', routerAddress);
  console.log('Pool WETH/USDC:      ', poolWethUsdc);
  console.log('Pool USDC/EURC:      ', poolUsdcEurc);
  console.log('Pool USDC/KRWC:      ', poolUsdcKrwc);
  console.log('=================================================');
}

main().catch((error) => {
  console.error('❌ Deployment failed:', error);
  process.exitCode = 1;
});
