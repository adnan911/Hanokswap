import { defineChain, formatUnits } from "viem";
import { mainnet, base, arbitrum, optimism, polygon, bsc, avalanche } from "viem/chains";

export { mainnet, base, arbitrum, optimism, polygon, bsc, avalanche };

export const giwaSepolia = defineChain({
  id: 91342,
  name: "GIWA Sepolia",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://sepolia-rpc.giwa.io"],
      webSocket: ["wss://sepolia-rpc.giwa.io/ws"],
    },
    flashblocks: {
      http: ["https://sepolia-rpc-flashblocks.giwa.io"],
      webSocket: ["wss://sepolia-rpc-flashblocks.giwa.io/ws"],
    },
    public: {
      http: ["https://sepolia-rpc.giwa.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "GIWA Explorer",
      url: "https://sepolia-explorer.giwa.io",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 1,
    },
  },
  testnet: true,
});

export const GIWA_SEPOLIA_CHAIN_ID = 91342;
export const GIWA_FLASHBLOCKS_RPC = "https://sepolia-rpc-flashblocks.giwa.io";
export const GIWA_STANDARD_RPC = "https://sepolia-rpc.giwa.io";

export const SUPPORTED_CHAINS = [
  giwaSepolia,
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  bsc,
  avalanche,
];

export const DEFAULT_CHAIN = giwaSepolia;

export const USDC_ERC20_DECIMALS = 6;

export function formatUsdcErc20(raw: bigint): number {
  return Number(formatUnits(raw, USDC_ERC20_DECIMALS));
}

export function formatArcNative(raw: bigint): number {
  return Number(formatUnits(raw, 18));
}

export function formatEth(raw: bigint): number {
  return Number(formatUnits(raw, 18));
}

// Backward compatibility constants
export const ARC_CHAIN_ID = 91342;
export const ARC_CHAIN_ID_HEX = "0x164ce" as const;
export const ARC_MAINNET_CHAIN_ID = 91342;
export const ARC_MAINNET_CHAIN_ID_HEX = "0x164ce" as const;
export const arcTestnet = giwaSepolia;
export const arcMainnet = giwaSepolia;

