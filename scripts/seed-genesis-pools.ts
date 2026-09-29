import { createWalletClient, createPublicClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { giwaSepolia, GIWA_STANDARD_RPC } from "../src/chains";
import { GIWA_POOL_WETH_USDC, GIWA_POOL_USDC_EURC } from "../src/contracts";
import dotenv from "dotenv";

dotenv.config();

const CL_POOL_ABI = [
  {
    inputs: [{ name: "sqrtPriceX96", type: "uint160" }],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "slot0",
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function main() {
  const privateKey = (process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY) as `0x${string}`;

  if (!privateKey) {
    console.error("❌ ERROR: DEPLOYER_PRIVATE_KEY is missing in your .env file.");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);

  console.log("=================================================");
  console.log("🚀 Giwa DEX Genesis Pool Initialization Step");
  console.log("=================================================");
  console.log("Deployer:", account.address);
  console.log("CLAMM Pool (WETH/USDC):", GIWA_POOL_WETH_USDC);
  console.log("Stable Pool (USDC/EURC):", GIWA_POOL_USDC_EURC);
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

  // 1. Check if CLAMM pool is already initialized
  const slot0Before = await publicClient.readContract({
    address: GIWA_POOL_WETH_USDC,
    abi: CL_POOL_ABI,
    functionName: "slot0",
  });

  if (slot0Before[0] > 0n) {
    console.log("ℹ️ WETH/USDC Pool already initialized. Current sqrtPriceX96:", slot0Before[0].toString(), "Tick:", slot0Before[1]);
  } else {
    // Standard sqrtPriceX96 for 1 ETH = ~2,600 USDC (token0 = USDC 6 dec, token1 = WETH 18 dec)
    // raw P = 10^18 / (2600 * 10^6) = 10^12 / 2600 ≈ 384615384.615
    // sqrt(P) ≈ 19611.613513824
    // sqrtPriceX96 = floor(19611.613513824 * 2^96) ≈ 1553792036737562629559404289870n
    const INITIAL_SQRT_PRICE_X96 = 1553792036737562629559404289870n;

    console.log("1. ⚙️ Initializing WETH/USDC CLAMM Pool price (1 ETH = $2,600 USDC)...");
    const initTx = await walletClient.writeContract({
      address: GIWA_POOL_WETH_USDC,
      abi: CL_POOL_ABI,
      functionName: "initialize",
      args: [INITIAL_SQRT_PRICE_X96],
    });

    console.log("   Tx Hash:", initTx);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: initTx });
    console.log("   ✅ Pool initialized successfully! Block:", receipt.blockNumber);

    const slot0After = await publicClient.readContract({
      address: GIWA_POOL_WETH_USDC,
      abi: CL_POOL_ABI,
      functionName: "slot0",
    });
    console.log("   Current sqrtPriceX96:", slot0After[0].toString(), "Initial Tick:", slot0After[1]);
  }

  console.log("\n=================================================");
  console.log("🎉 Genesis Pool Initialization Complete!");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("❌ Initialization failed:", err);
  process.exit(1);
});
