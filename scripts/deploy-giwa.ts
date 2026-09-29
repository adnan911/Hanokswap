import { createWalletClient, createPublicClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { giwaSepolia, GIWA_STANDARD_RPC } from "../src/chains";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

function loadArtifact(relativePath: string) {
  const fullPath = path.join(process.cwd(), "artifacts", relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Artifact not found at ${fullPath}. Run hardhat compile first.`);
  }
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

async function main() {
  const privateKey = (process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY) as `0x${string}`;

  if (!privateKey) {
    console.error("❌ ERROR: DEPLOYER_PRIVATE_KEY is missing in your .env file.");
    console.log("👉 Please set DEPLOYER_PRIVATE_KEY=0x... in .env and run again.");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
  const treasuryAddress = (process.env.TREASURY_ADDRESS || account.address) as Address;

  console.log("=================================================");
  console.log("🚀 Giwa DEX Protocol Testnet Deployment");
  console.log("=================================================");
  console.log("Network:      Giwa Sepolia (Chain ID: 91342)");
  console.log("RPC Endpoint: " + GIWA_STANDARD_RPC);
  console.log("Deployer:    ", account.address);
  console.log("Treasury:    ", treasuryAddress);
  console.log("=================================================\n");

  const publicClient = createPublicClient({
    chain: giwaSepolia,
    transport: http(GIWA_STANDARD_RPC),
  });

  const walletClient = createWalletClient({
    account,
    chain: giwaSepolia,
    transport: http(GIWA_STANDARD_RPC),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  const balanceEth = Number(balance) / 1e18;
  console.log(`💰 Deployer Balance: ${balanceEth} ETH`);

  if (balance === 0n) {
    console.error("\n❌ ERROR: Deployer wallet has 0 ETH on Giwa Sepolia.");
    console.log("👉 Please get testnet ETH from https://faucet.giwa.io for address:", account.address);
    process.exit(1);
  }

  // 1. Deploy ProtocolFeeVault
  console.log("\n1. 📦 Deploying ProtocolFeeVault (70/20/10 Fee Splitter)...");
  const feeVaultArtifact = loadArtifact("contracts/governance/ProtocolFeeVault.sol/ProtocolFeeVault.json");
  const feeVaultHash = await walletClient.deployContract({
    abi: feeVaultArtifact.abi,
    bytecode: feeVaultArtifact.bytecode,
    args: [treasuryAddress],
  });
  console.log("   Tx Hash:", feeVaultHash);
  const feeVaultReceipt = await publicClient.waitForTransactionReceipt({ hash: feeVaultHash });
  const feeVaultAddress = feeVaultReceipt.contractAddress!;
  console.log("   ✅ ProtocolFeeVault deployed at:", feeVaultAddress);

  // 2. Deploy Dedicated Pool Deployers
  console.log("\n2. 📦 Deploying GiwaCLDeployer...");
  const clDeployerArtifact = loadArtifact("contracts/core/GiwaCLDeployer.sol/GiwaCLDeployer.json");
  const clDeployerHash = await walletClient.deployContract({
    abi: clDeployerArtifact.abi,
    bytecode: clDeployerArtifact.bytecode,
    args: [],
  });
  console.log("   Tx Hash:", clDeployerHash);
  const clDeployerReceipt = await publicClient.waitForTransactionReceipt({ hash: clDeployerHash });
  const clDeployerAddress = clDeployerReceipt.contractAddress!;
  console.log("   ✅ GiwaCLDeployer deployed at:", clDeployerAddress);

  console.log("\n3. 📦 Deploying GiwaStableDeployer...");
  const stableDeployerArtifact = loadArtifact("contracts/core/GiwaStableDeployer.sol/GiwaStableDeployer.json");
  const stableDeployerHash = await walletClient.deployContract({
    abi: stableDeployerArtifact.abi,
    bytecode: stableDeployerArtifact.bytecode,
    args: [],
  });
  console.log("   Tx Hash:", stableDeployerHash);
  const stableDeployerReceipt = await publicClient.waitForTransactionReceipt({ hash: stableDeployerHash });
  const stableDeployerAddress = stableDeployerReceipt.contractAddress!;
  console.log("   ✅ GiwaStableDeployer deployed at:", stableDeployerAddress);

  // 4. Deploy GiwaPoolFactory
  console.log("\n4. 📦 Deploying GiwaPoolFactory (CLAMM & Stableswap Factory)...");
  const factoryArtifact = loadArtifact("contracts/core/GiwaPoolFactory.sol/GiwaPoolFactory.json");
  const factoryHash = await walletClient.deployContract({
    abi: factoryArtifact.abi,
    bytecode: factoryArtifact.bytecode,
    args: [feeVaultAddress, clDeployerAddress, stableDeployerAddress],
  });
  console.log("   Tx Hash:", factoryHash);
  const factoryReceipt = await publicClient.waitForTransactionReceipt({ hash: factoryHash });
  const factoryAddress = factoryReceipt.contractAddress!;
  console.log("   ✅ GiwaPoolFactory deployed at:", factoryAddress);

  // 5. Authorize Factory in Deployers
  console.log("\n5. 🔐 Authorizing Factory in Deployers...");
  const setClFactoryTx = await walletClient.writeContract({
    address: clDeployerAddress,
    abi: clDeployerArtifact.abi,
    functionName: "setFactory",
    args: [factoryAddress],
  });
  await publicClient.waitForTransactionReceipt({ hash: setClFactoryTx });

  const setStableFactoryTx = await walletClient.writeContract({
    address: stableDeployerAddress,
    abi: stableDeployerArtifact.abi,
    functionName: "setFactory",
    args: [factoryAddress],
  });
  await publicClient.waitForTransactionReceipt({ hash: setStableFactoryTx });
  console.log("   ✅ Factory authorized in CL & Stable Deployers!");

  // 6. Deploy GiwaUniversalRouter
  const WETH9 = "0x4200000000000000000000000000000000000006" as Address;
  console.log("\n6. 📦 Deploying GiwaUniversalRouter (Universal Swap Aggregator)...");
  const routerArtifact = loadArtifact("contracts/periphery/GiwaUniversalRouter.sol/GiwaUniversalRouter.json");
  const routerHash = await walletClient.deployContract({
    abi: routerArtifact.abi,
    bytecode: routerArtifact.bytecode,
    args: [factoryAddress, WETH9],
  });
  console.log("   Tx Hash:", routerHash);
  const routerReceipt = await publicClient.waitForTransactionReceipt({ hash: routerHash });
  const routerAddress = routerReceipt.contractAddress!;
  console.log("   ✅ GiwaUniversalRouter deployed at:", routerAddress);

  // 7. Initialize Genesis Pools
  const USDC = "0x3600000000000000000000000000000000000000" as Address;
  const EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as Address;

  console.log("\n7. 🏊 Initializing Genesis Liquidity Pools...");
  console.log("   a) WETH / USDC Volatile Pair (0.30% fee CLAMM)...");
  const pool1Tx = await walletClient.writeContract({
    address: factoryAddress,
    abi: factoryArtifact.abi,
    functionName: "createPool",
    args: [WETH9, USDC, 3000, false],
  });
  const pool1Receipt = await publicClient.waitForTransactionReceipt({ hash: pool1Tx });
  console.log("   ✅ WETH/USDC CLAMM Pool initialized! Tx:", pool1Receipt.transactionHash);

  console.log("   b) USDC / EURC Pegged Pair (0.01% fee Stableswap)...");
  const pool2Tx = await walletClient.writeContract({
    address: factoryAddress,
    abi: factoryArtifact.abi,
    functionName: "createPool",
    args: [USDC, EURC, 100, true],
  });
  const pool2Receipt = await publicClient.waitForTransactionReceipt({ hash: pool2Tx });
  console.log("   ✅ USDC/EURC Stableswap Pool initialized! Tx:", pool2Receipt.transactionHash);

  console.log("\n=================================================");
  console.log("🎉 ALL PROTOCOL CONTRACTS LIVE ON GIWA SEPOLIA!");
  console.log("=================================================");
  console.log("ProtocolFeeVault:    ", feeVaultAddress);
  console.log("GiwaCLDeployer:      ", clDeployerAddress);
  console.log("GiwaStableDeployer:  ", stableDeployerAddress);
  console.log("GiwaPoolFactory:     ", factoryAddress);
  console.log("GiwaUniversalRouter: ", routerAddress);
  console.log("Explorer URL:         https://sepolia-explorer.giwa.io");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
