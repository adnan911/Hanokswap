import { createWalletClient, createPublicClient, http, type Address, encodeAbiParameters, parseAbiParameters, stringToHex, pad } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { giwaSepolia, GIWA_STANDARD_RPC } from "../src/chains";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

function loadArtifact(relativePath: string) {
  const fullPath = path.join(process.cwd(), "artifacts", relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Artifact not found at ${fullPath}. Run npx hardhat compile first.`);
  }
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

export async function deployDojang() {
  const privateKey = (process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY) as `0x${string}`;

  if (!privateKey) {
    console.error("❌ ERROR: DEPLOYER_PRIVATE_KEY is missing in your .env file.");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);

  console.log("=================================================");
  console.log("🛡️ Giwa Dojang (EAS) & up.id Ecosystem Deployment");
  console.log("=================================================");
  console.log("Network:      Giwa Sepolia (Chain ID: 91342)");
  console.log("Deployer:    ", account.address);
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

  // 1. Deploy SchemaBook
  console.log("\n1. 📜 Deploying SchemaBook (Schema Registry)...");
  const schemaBookArtifact = loadArtifact("contracts/dojang/SchemaBook.sol/SchemaBook.json");
  const schemaBookHash = await walletClient.deployContract({
    abi: schemaBookArtifact.abi,
    bytecode: schemaBookArtifact.bytecode,
    args: [],
  });
  const schemaBookReceipt = await publicClient.waitForTransactionReceipt({ hash: schemaBookHash });
  const schemaBookAddress = schemaBookReceipt.contractAddress!;
  console.log("   ✅ SchemaBook deployed at:", schemaBookAddress);

  // 2. Deploy DojangScroll
  console.log("\n2. 📜 Deploying DojangScroll (EAS Core Ledger)...");
  const dojangScrollArtifact = loadArtifact("contracts/dojang/DojangScroll.sol/DojangScroll.json");
  const dojangScrollHash = await walletClient.deployContract({
    abi: dojangScrollArtifact.abi,
    bytecode: dojangScrollArtifact.bytecode,
    args: [schemaBookAddress],
  });
  const dojangScrollReceipt = await publicClient.waitForTransactionReceipt({ hash: dojangScrollHash });
  const dojangScrollAddress = dojangScrollReceipt.contractAddress!;
  console.log("   ✅ DojangScroll deployed at:", dojangScrollAddress);

  // 3. Deploy UpIdRegistry
  console.log("\n3. 🪪 Deploying UpIdRegistry (up.id Web3 Name Service)...");
  const upIdRegistryArtifact = loadArtifact("contracts/dojang/UpIdRegistry.sol/UpIdRegistry.json");
  const upIdRegistryHash = await walletClient.deployContract({
    abi: upIdRegistryArtifact.abi,
    bytecode: upIdRegistryArtifact.bytecode,
    args: [],
  });
  const upIdRegistryReceipt = await publicClient.waitForTransactionReceipt({ hash: upIdRegistryHash });
  const upIdRegistryAddress = upIdRegistryReceipt.contractAddress!;
  console.log("   ✅ UpIdRegistry deployed at:", upIdRegistryAddress);

  // 4. Register Core Schemas in SchemaBook
  console.log("\n4. ⚙️ Registering Core Schemas in SchemaBook...");
  
  // 4a. KYC Schema
  const kycSchemaTx = await walletClient.writeContract({
    address: schemaBookAddress,
    abi: schemaBookArtifact.abi,
    functionName: "register",
    args: ["bool isUpbitKYCVerified,uint8 tier,bytes32 countryCode", "0x0000000000000000000000000000000000000000", true],
  });
  const kycReceipt = await publicClient.waitForTransactionReceipt({ hash: kycSchemaTx });
  console.log("   ✅ KYC Schema registered! Tx:", kycReceipt.transactionHash);

  // 4b. VIP Trader Schema
  const vipSchemaTx = await walletClient.writeContract({
    address: schemaBookAddress,
    abi: schemaBookArtifact.abi,
    functionName: "register",
    args: ["bool isVIPTrader,uint256 monthlyVolumeUSD", "0x0000000000000000000000000000000000000000", true],
  });
  const vipReceipt = await publicClient.waitForTransactionReceipt({ hash: vipSchemaTx });
  console.log("   ✅ VIP Schema registered! Tx:", vipReceipt.transactionHash);

  // 4c. Project Verification Schema
  const projectSchemaTx = await walletClient.writeContract({
    address: schemaBookAddress,
    abi: schemaBookArtifact.abi,
    functionName: "register",
    args: ["bool isDunamuVerifiedProject,string officialHandle", "0x0000000000000000000000000000000000000000", true],
  });
  const projectReceipt = await publicClient.waitForTransactionReceipt({ hash: projectSchemaTx });
  console.log("   ✅ Project Verification Schema registered! Tx:", projectReceipt.transactionHash);

  // Read schema UIDs
  const kycSchemaUID = await publicClient.readContract({
    address: schemaBookAddress,
    abi: schemaBookArtifact.abi,
    functionName: "getSchemaUIDByIndex",
    args: [0n],
  }) as `0x${string}`;

  const vipSchemaUID = await publicClient.readContract({
    address: schemaBookAddress,
    abi: schemaBookArtifact.abi,
    functionName: "getSchemaUIDByIndex",
    args: [1n],
  }) as `0x${string}`;

  const projectSchemaUID = await publicClient.readContract({
    address: schemaBookAddress,
    abi: schemaBookArtifact.abi,
    functionName: "getSchemaUIDByIndex",
    args: [2n],
  }) as `0x${string}`;

  // 5. Deploy DojangAttestationHook
  console.log("\n5. 🪝 Deploying DojangAttestationHook...");
  const hookArtifact = loadArtifact("contracts/dojang/DojangAttestationHook.sol/DojangAttestationHook.json");
  const hookHash = await walletClient.deployContract({
    abi: hookArtifact.abi,
    bytecode: hookArtifact.bytecode,
    args: [dojangScrollAddress, account.address, kycSchemaUID, vipSchemaUID, projectSchemaUID],
  });
  const hookReceipt = await publicClient.waitForTransactionReceipt({ hash: hookHash });
  const hookAddress = hookReceipt.contractAddress!;
  console.log("   ✅ DojangAttestationHook deployed at:", hookAddress);

  // 6. Deploy DojangFaucet
  console.log("\n6. 🚰 Deploying DojangFaucet (Sybil-Gated)...");
  const faucetArtifact = loadArtifact("contracts/dojang/DojangFaucet.sol/DojangFaucet.json");
  const faucetHash = await walletClient.deployContract({
    abi: faucetArtifact.abi,
    bytecode: faucetArtifact.bytecode,
    args: [hookAddress],
  });
  const faucetReceipt = await publicClient.waitForTransactionReceipt({ hash: faucetHash });
  const faucetAddress = faucetReceipt.contractAddress!;
  console.log("   ✅ DojangFaucet deployed at:", faucetAddress);

  console.log("\n=================================================");
  console.log("🎉 DOJANG & UP.ID PROTOCOL DEPLOYED SUCCESSFULLY!");
  console.log("=================================================");
  console.log("SchemaBook:            ", schemaBookAddress);
  console.log("DojangScroll (EAS):    ", dojangScrollAddress);
  console.log("UpIdRegistry:          ", upIdRegistryAddress);
  console.log("DojangAttestationHook: ", hookAddress);
  console.log("DojangFaucet:          ", faucetAddress);
  console.log("KYC Schema UID:        ", kycSchemaUID);
  console.log("VIP Schema UID:        ", vipSchemaUID);
  console.log("Project Schema UID:    ", projectSchemaUID);
  console.log("=================================================");

  return {
    schemaBookAddress,
    dojangScrollAddress,
    upIdRegistryAddress,
    hookAddress,
    faucetAddress,
    kycSchemaUID,
    vipSchemaUID,
    projectSchemaUID,
  };
}

if (process.argv[1]?.includes("deploy-dojang")) {
  deployDojang().catch((err) => {
    console.error("❌ Dojang deployment failed:", err);
    process.exit(1);
  });
}
