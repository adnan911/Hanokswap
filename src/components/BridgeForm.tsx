import { useState, useEffect } from "react";
import type { EIP1193Provider } from "viem";
import { createPublicClient, createWalletClient, custom, http, erc20Abi, encodePacked, zeroAddress, defineChain, parseEther } from "viem";
import { sepolia, baseSepolia, arbitrumSepolia, lineaSepolia, optimismSepolia, polygonAmoy, avalancheFuji, unichainSepolia, worldchainSepolia, inkSepolia, plumeSepolia, seiTestnet, hyperliquidEvmTestnet } from "viem/chains";

// The default public RPC endpoints viem ships for these testnets sometimes
// route through free-tier providers (e.g. drpc.org) that reject certain
// calls with "chain is not available on free plan". Pin a reliable public
// RPC per chain instead of trusting the SDK defaults.
const sepoliaReliable = { ...sepolia, rpcUrls: { default: { http: ["https://ethereum-sepolia-rpc.publicnode.com"] } } };
const baseSepoliaReliable = { ...baseSepolia, rpcUrls: { default: { http: ["https://base-sepolia-rpc.publicnode.com"] } } };
const arbitrumSepoliaReliable = { ...arbitrumSepolia, rpcUrls: { default: { http: ["https://arbitrum-sepolia-rpc.publicnode.com"] } } };
const lineaSepoliaReliable = { ...lineaSepolia, rpcUrls: { default: { http: ["https://linea-sepolia-rpc.publicnode.com"] } } };
const optimismSepoliaReliable = { ...optimismSepolia, rpcUrls: { default: { http: ["https://optimism-sepolia-rpc.publicnode.com"] } } };
const polygonAmoyReliable = { ...polygonAmoy, rpcUrls: { default: { http: ["https://polygon-amoy-bor-rpc.publicnode.com"] } } };
const avalancheFujiReliable = { ...avalancheFuji, rpcUrls: { default: { http: ["https://avalanche-fuji-c-chain-rpc.publicnode.com"] } } };
// viem's built-in sonicTestnet uses the wrong chain ID (64165); the real Sonic Testnet
// is 14601 — this matches Circle's own CCTP reference implementation exactly.
const sonicTestnet = defineChain({
  id: 14601,
  name: "Sonic Testnet",
  nativeCurrency: { decimals: 18, name: "Sonic", symbol: "S" },
  rpcUrls: { default: { http: ["https://rpc.testnet.soniclabs.com"] } },
  blockExplorers: { default: { name: "SonicScan", url: "https://testnet.sonicscan.org" } },
  testnet: true,
});
import { arcTestnet, ARC_CHAIN_ID_HEX } from "../chains";
import { showToast } from "../toast";
import { getPendingFollowUp, clearPendingFollowUp, type PendingFollowUp } from "../pendingFollowUp";
import { addPoints } from "../gamification";
import { ChainIcon } from "./ChainIcon";
import { TokenIcon } from "./TokenIcon";
import ConfirmModal from "./ConfirmModal";
import { useIsMobile } from "../useIsMobile";
import { getCircleWallet, circleContractCallAndWait, getWalletIdForChain, type CircleWalletInfo, type CircleChain } from "../circleWalletHelpers";
import { ShieldCheck, ChevronDown, ArrowDownUp, ArrowRight, BookOpen, Wallet, CircleDollarSign, HelpCircle, X, Check, ExternalLink } from "lucide-react";
import { CCTP_TOKEN_MESSENGER as TOKEN_MESSENGER, CCTP_MESSAGE_TRANSMITTER as MESSAGE_TRANSMITTER, USDC_ADDRESS, EURC_ADDRESS } from "../contracts";

// EURC (and other non-USDC assets) don't move through the canonical TokenMessengerV2.depositForBurn
// path at all — that's USDC-only. They go through a separate Circle product, "CCTPx" (Expanded
// Assets), with its own CrossChainTokenService contract, per-token TokenManager, a bytes32 tokenId,
// and a required signed fee quote from Iris. Confirmed live only between Ethereum Sepolia and Base
// Sepolia as of Circle's own quickstart — not confirmed for Arc Testnet.
const CCTS_ADDRESS: Partial<Record<ChainKey, `0x${string}`>> = {
  "Ethereum Sepolia": "0x63753E722bd2C2A5DF6EE19C5106662208B81077",
  "Base Sepolia": "0x63753E722bd2C2A5DF6EE19C5106662208B81077",
};
const EURC_TOKEN_ID = "0x2587821a0ee7daa174b95436b5dab1731cfa1844775b010217d3c0dd02a4eecd" as `0x${string}`;

const BASE_L1_BRIDGE = "0xc0d598bee79a93a442556c451204c71059ffa0d5" as `0x${string}`;
const ARBITRUM_INBOX = "0xaAe29B0366299461418F5324a79Afc425BE5ae21" as `0x${string}`;
const ARBITRUM_INBOX_ABI = [
  { type: "function", name: "depositEth", stateMutability: "payable", inputs: [{ name: "destAddr", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

const CCTS_ABI = [
  { name: "resolveTokenManager", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "bytes32" }], outputs: [{ name: "tokenManager", type: "address" }] },
  { name: "resolveTokenAddress", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "bytes32" }], outputs: [{ name: "token", type: "address" }] },
] as const;

const CROSS_CHAIN_TRANSFER_ABI = [{
  name: "crossChainTransfer", type: "function", stateMutability: "payable",
  inputs: [
    { name: "tokenId", type: "bytes32" },
    { name: "amount", type: "uint256" },
    { name: "destinationDomain", type: "uint32" },
    { name: "destinationAddress", type: "bytes" },
    { name: "destinationCaller", type: "bytes32" },
    { name: "minFinalityThreshold", type: "uint32" },
    { name: "claim", type: "tuple", components: [
      { name: "signedQuote", type: "bytes" },
      { name: "refundAddress", type: "address" },
    ] },
    { name: "autoExecuteHookData", type: "bool" },
    { name: "hookData", type: "bytes" },
  ],
  outputs: [],
}] as const;

function parseIrisResponse(text: string, status: number): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("<")) {
    const snippet = trimmed.slice(0, 300).replace(/\s+/g, " ");
    throw new Error(`Non-JSON (HTML) response from /api/iris-proxy — HTTP ${status}. First 300 chars: ${snippet}`);
  }
  return JSON.parse(text);
}

async function irisProxyGet(path: string) {
  try {
    const direct = await fetch(`https://iris-api-sandbox.circle.com${path}`);
    const directText = await direct.text();
    const directData = parseIrisResponse(directText, direct.status);
    if (!direct.ok) throw new Error(typeof directData === "string" ? directData : JSON.stringify(directData));
    return directData;
  } catch {
    // Fall through to the proxy below.
  }
  const res = await fetch(`/api/iris-proxy?path=${encodeURIComponent(path)}`);
  const text = await res.text();
  const data = parseIrisResponse(text, res.status);
  if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

async function irisProxyPost(path: string, body: unknown) {
  const res = await fetch(`/api/iris-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, body }),
  });
  const text = await res.text();
  const data = parseIrisResponse(text, res.status);
  if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

async function fetchCctpxQuote(tokenId: `0x${string}`, sourceDomain: number, destDomain: number, amount: bigint) {
  const data = await irisProxyPost(`/v1/quote/cctpx/${tokenId}/${sourceDomain}/${destDomain}`, {
    amount: amount.toString(),
    feeToken: "0x0000000000000000000000000000000000000000",
    requests: [{ type: "PRE_FINALITY" }],
  });
  return data as { signedQuote: `0x${string}`; feeTotalAmount: string };
}

async function checkCctpxFastAllowance(tokenId: `0x${string}`, amountUnits: bigint, decimals: number) {
  const body = (await irisProxyGet(`/v2/cctpx/allowances`)) as { allowances: { tokenId: string; allowance: number }[] };
  const allowance = body.allowances?.find(a => a.tokenId.toLowerCase() === tokenId.toLowerCase())?.allowance;
  const amountInTokenUnits = Number(amountUnits) / 10 ** decimals;
  if (allowance === undefined || allowance < amountInTokenUnits) {
    throw new Error(`Insufficient CCTPx fast-transfer allowance right now (available: ${allowance ?? 0}, need: ${amountInTokenUnits}). Try a smaller amount, or try again in a bit once allowance replenishes.`);
  }
}

export const CHAINS = {
  "Arc Testnet": { chain: arcTestnet, domain: 26, usdc: USDC_ADDRESS, eurc: EURC_ADDRESS as `0x${string}` | null, chainIdHex: ARC_CHAIN_ID_HEX, isArc: true, circleChain: "ARC-TESTNET" as CircleChain, dot: "#6D5EF7" },
  "Ethereum Sepolia": { chain: sepoliaReliable, domain: 0, usdc: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" as `0x${string}`, eurc: "0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4" as `0x${string}` | null, chainIdHex: "0xaa36a7", isArc: false, circleChain: "ETH-SEPOLIA" as CircleChain, dot: "#627eea" },
  "Base Sepolia": { chain: baseSepoliaReliable, domain: 6, usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`, eurc: "0x808456652fdb597867f38412077A9182bf77359F" as `0x${string}` | null, chainIdHex: "0x14a34", isArc: false, circleChain: "BASE-SEPOLIA" as CircleChain, dot: "#0052ff" },
  "Arbitrum Sepolia": { chain: arbitrumSepoliaReliable, domain: 3, usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as `0x${string}`, eurc: null as `0x${string}` | null, chainIdHex: "0x66eee", isArc: false, circleChain: "ARB-SEPOLIA" as CircleChain, dot: "#28a0f0" },
  "Linea Sepolia": { chain: lineaSepoliaReliable, domain: 11, usdc: "0xFEce4462D57bD51A6A552365A011b95f0E16d9B7" as `0x${string}`, eurc: null as `0x${string}` | null, chainIdHex: "0xe705", isArc: false, circleChain: "LINEA-SEPOLIA" as CircleChain },
  "Optimism Sepolia": { chain: optimismSepoliaReliable, domain: 2, usdc: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7" as `0x${string}`, eurc: null as `0x${string}` | null, chainIdHex: "0xaa37dc", isArc: false, circleChain: "OP-SEPOLIA" as CircleChain },
  "Polygon Amoy": { chain: polygonAmoyReliable, domain: 7, usdc: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582" as `0x${string}`, eurc: null as `0x${string}` | null, chainIdHex: "0x13882", isArc: false, circleChain: "MATIC-AMOY" as CircleChain },
  "Avalanche Fuji": { chain: avalancheFujiReliable, domain: 1, usdc: "0x5425890298aed601595a70AB815c96711a31Bc65" as `0x${string}`, eurc: null as `0x${string}` | null, chainIdHex: "0xa869", isArc: false, circleChain: "AVAX-FUJI" as CircleChain },
  "Sonic Testnet": { chain: sonicTestnet, domain: 13, usdc: "0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51" as `0x${string}`, eurc: null as `0x${string}` | null, chainIdHex: "0x3909", isArc: false, circleChain: "SONIC-TESTNET" as CircleChain },
  "Unichain Sepolia": { chain: unichainSepolia, domain: 10, usdc: "0x31d0220469e10c4E71834a79b1f276d740d3768F" as `0x${string}`, eurc: null as `0x${string}` | null, chainIdHex: "0x515", isArc: false, circleChain: "UNICHAIN-SEPOLIA" as CircleChain },
  "World Chain Sepolia": { chain: worldchainSepolia, domain: 14, usdc: "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88" as `0x${string}`, eurc: null as `0x${string}` | null, chainIdHex: "0x12c1", isArc: false, circleChain: "WORLDCHAIN-SEPOLIA" as CircleChain },
  "Ink Sepolia": { chain: inkSepolia, domain: 21, usdc: "0xFabab97dCE620294D2B0b0e46C68964e326300Ac" as `0x${string}`, eurc: null as `0x${string}` | null, chainIdHex: "0xba5ed", isArc: false, circleChain: "INK-SEPOLIA" as CircleChain },
  "Plume Testnet": { chain: plumeSepolia, domain: 22, usdc: "0xcB5f30e335672893c7eb944B374c196392C19D18" as `0x${string}`, eurc: null as `0x${string}` | null, chainIdHex: "0x18233", isArc: false, circleChain: "PLUME-SEPOLIA" as CircleChain },
  "Sei Testnet": { chain: seiTestnet, domain: 16, usdc: "0x4fCF1784B31630811181f670Aea7A7bEF803eaED" as `0x${string}`, eurc: null as `0x${string}` | null, chainIdHex: "0x530", isArc: false, circleChain: "SEI-TESTNET" as CircleChain },
  "HyperEVM Testnet": { chain: hyperliquidEvmTestnet, domain: 19, usdc: "0x2B3370eE501B4a559b57D449569354196457D8Ab" as `0x${string}`, eurc: null as `0x${string}` | null, chainIdHex: "0x3e6", isArc: false, circleChain: "HYPEREVM-TESTNET" as CircleChain },
} as const;
export type ChainKey = keyof typeof CHAINS;
export type Asset = "usdc" | "eurc";
export type BridgeToken = "USDC" | "EURC" | "ETH";

const BRIDGE_TOKENS = [
  { symbol: "USDC" as const, name: "USD Coin", desc: "Circle CCTP v2", badge: "$" },
  { symbol: "EURC" as const, name: "Euro Coin", desc: "Circle CCTPx", badge: "€" },
  { symbol: "ETH" as const, name: "Ether", desc: "Canonical L1 Bridge", badge: "Ξ" },
];

const ASSET_META: Record<Asset, { label: string; badge: string; color: string }> = {
  usdc: { label: "USDC", badge: "$", color: "#6D5EF7" },
  eurc: { label: "EURC", badge: "€", color: "#7c3aed" },
};

function assetAddress(c: (typeof CHAINS)[ChainKey], asset: Asset): `0x${string}` | null {
  return asset === "usdc" ? c.usdc : c.eurc;
}

function finalityParams(asset: Asset): { maxFee: bigint; minFinalityThreshold: number } {
  return asset === "usdc" ? { maxFee: 500n, minFinalityThreshold: 1000 } : { maxFee: 0n, minFinalityThreshold: 2000 };
}

interface Props {
  provider: EIP1193Provider;
  address: string;
  walletName: string;
  onNavigate?: (tab: "swap") => void;
}

const DEPOSIT_FOR_BURN_ABI = [{
  type: "function", name: "depositForBurn", stateMutability: "nonpayable",
  inputs: [
    { name: "amount", type: "uint256" },
    { name: "destinationDomain", type: "uint32" },
    { name: "mintRecipient", type: "bytes32" },
    { name: "burnToken", type: "address" },
    { name: "destinationCaller", type: "bytes32" },
    { name: "maxFee", type: "uint256" },
    { name: "minFinalityThreshold", type: "uint32" },
  ],
  outputs: [],
}] as const;

const RECEIVE_MESSAGE_ABI = [{
  type: "function", name: "receiveMessage", stateMutability: "nonpayable",
  inputs: [{ name: "message", type: "bytes" }, { name: "attestation", type: "bytes" }],
  outputs: [],
}] as const;

async function switchChain(provider: EIP1193Provider, chainIdHex: string, addParams?: any) {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
  } catch (e: unknown) {
    const err = e as { code?: number };
    if (err.code === 4902 && addParams) {
      await provider.request({ method: "wallet_addEthereumChain", params: [addParams] });
      return;
    }
    throw e;
  }

  if (addParams) {
    try {
      await provider.request({ method: "wallet_addEthereumChain", params: [addParams] });
    } catch {
      // Ignore
    }
  }
}

function addChainParams(key: ChainKey) {
  const c = CHAINS[key];
  if (key === "Arc Testnet") {
    return { chainId: c.chainIdHex, chainName: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: ["https://rpc.testnet.arc.network"], blockExplorerUrls: ["https://testnet.arcscan.app"] };
  }
  return {
    chainId: c.chainIdHex, chainName: key,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: [c.chain.rpcUrls.default.http[0]],
    blockExplorerUrls: [c.chain.blockExplorers?.default.url ?? ""],
  };
}

function bytes32Address(addr: string): `0x${string}` {
  return `0x000000000000000000000000${addr.slice(2)}` as `0x${string}`;
}

function friendlyError(e: unknown): string {
  const err = e as { message?: string; code?: number; shortMessage?: string };
  if (err.code === 4001 || err.message?.includes("User rejected")) {
    return "You rejected the request in your wallet. No funds were moved — try again when you're ready.";
  }
  if (err.message?.includes("insufficient funds") || err.message?.includes("exceeds balance")) {
    return "Insufficient balance to cover this amount plus gas.";
  }
  return err.shortMessage ?? err.message ?? "Bridge failed. Please try again.";
}

const HOW_IT_WORKS_DATA: Record<BridgeToken, { steps: { title: string; desc: string }[]; footer: string }> = {
  USDC: {
    steps: [
      { title: "Select assets", desc: "Choose source and destination chains, and USDC amount to bridge" },
      { title: "Approve & Burn", desc: "Approve the transfer and burn USDC natively on the source chain" },
      { title: "Attestation", desc: "Circle verifies the burn and produces a signed cryptographic attestation" },
      { title: "Receive on destination", desc: "Native USDC is minted directly to your wallet on the destination chain" },
    ],
    footer: "Powered by Circle's CCTP V2: burns USDC on the source chain and mints native USDC on the destination — no wrapped tokens, no bridge risk.",
  },
  EURC: {
    steps: [
      { title: "Select Pair", desc: "Bridge EURC between Ethereum Sepolia and Base Sepolia" },
      { title: "Approve TokenManager", desc: "Approve EURC to Circle's CrossChainTokenService TokenManager" },
      { title: "Iris Fee Quote", desc: "Circle Iris provides a fast, signed transfer quote" },
      { title: "Mint Native EURC", desc: "Native EURC is claimed directly to your wallet on destination" },
    ],
    footer: "Powered by Circle's CCTPx (Expanded Assets) protocol with Iris fast attestation.",
  },
  ETH: {
    steps: [
      { title: "Select Destination L2", desc: "Choose Base Sepolia or Arbitrum Sepolia" },
      { title: "Deposit on L1", desc: "Send ETH to the official canonical rollup bridge on Ethereum Sepolia" },
      { title: "Rollup Relay", desc: "The L2 rollup sequencer automatically processes the deposit and credits native ETH" },
      { title: "Ready on L2", desc: "Use your deposited ETH directly for gas and transactions on the L2 rollup" },
    ],
    footer: "Direct canonical L1→L2 bridge with trustless native rollup security.",
  },
};

  function ChainRow({
    chainKey,
    open,
    setOpen,
    onSelect,
    allowedChains,
    isLoading,
  }: {
    chainKey: ChainKey;
    open: boolean;
    setOpen: (v: boolean) => void;
    onSelect: (k: ChainKey) => void;
    allowedChains: ChainKey[];
    isLoading: boolean;
  }) {
    const isSingle = allowedChains.length <= 1;
    return (
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => { if (!isSingle) setOpen(!open); }}
          disabled={isLoading}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            borderRadius: 14,
            border: "1px solid rgba(226, 224, 200, 0.14)",
            background: "rgba(15, 20, 19, 0.8)",
            cursor: isSingle || isLoading ? "default" : "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ChainIcon name={chainKey} size={26} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#E2E0C8" }}>{chainKey}</span>
            </div>
          </div>
          {!isSingle && <ChevronDown size={16} color="#A6B49E" />}
        </button>
        {open && !isSingle && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              zIndex: 30,
              background: "rgba(15, 20, 19, 0.96)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(226, 224, 200, 0.16)",
              borderRadius: 14,
              padding: 6,
              boxShadow: "0 16px 36px rgba(0,0,0,0.8)",
              maxHeight: 260,
              overflowY: "auto",
            }}
          >
            {allowedChains.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onSelect(k)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0.6rem 0.75rem",
                  borderRadius: 10,
                  border: "none",
                  background: k === chainKey ? "rgba(166, 180, 158, 0.15)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <ChainIcon name={k} size={22} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#E2E0C8" }}>{k}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

export default function BridgeForm({ provider, address, onNavigate }: Props) {
  const isMobile = useIsMobile();
  const [followUp, setFollowUp] = useState<PendingFollowUp | null>(null);
  const [selectedToken, setSelectedToken] = useState<BridgeToken>("USDC");
  const [tokenDropdownOpen, setTokenDropdownOpen] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const [asset, setAsset] = useState<Asset>("usdc");
  const [sourceKey, setSourceKey] = useState<ChainKey>("Ethereum Sepolia");
  const [destKey, setDestKey] = useState<ChainKey>("Arc Testnet");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"idle" | "approving" | "burning" | "attesting" | "minting" | "done" | "error">("idle");

  useEffect(() => {
    if (step === "done") {
      const pending = getPendingFollowUp();
      if (pending) {
        setFollowUp(pending);
        clearPendingFollowUp();
      }
    }
  }, [step]);

  const [burnTxHash, setBurnTxHash] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [circleWallet, setCircleWallet] = useState<CircleWalletInfo | null>(null);
  const [useCircle, setUseCircle] = useState(false);

  useEffect(() => {
    setCircleWallet(getCircleWallet());
    function handleWalletChange() { setCircleWallet(getCircleWallet()); }
    window.addEventListener("circle-wallet-changed", handleWalletChange);
    return () => window.removeEventListener("circle-wallet-changed", handleWalletChange);
  }, []);

  const source = CHAINS[sourceKey];
  const dest = CHAINS[destKey];

  const [sourceBalance, setSourceBalance] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSourceBalance(null);
    const effectiveAddress = useCircle && circleWallet ? circleWallet.address : address;

    if (selectedToken === "ETH") {
      (async () => {
        try {
          const client = createPublicClient({ chain: sepoliaReliable, transport: http() });
          const bal = await client.getBalance({ address: effectiveAddress as `0x${string}` });
          if (!cancelled) setSourceBalance((Number(bal) / 1e18).toFixed(4));
        } catch {
          if (!cancelled) setSourceBalance("—");
        }
      })();
      return () => { cancelled = true; };
    }

    const tokenAddr = assetAddress(source, asset);
    if (!tokenAddr) { setSourceBalance("—"); return; }
    (async () => {
      try {
        const client = createPublicClient({ chain: source.chain, transport: http() });
        const bal = await client.readContract({ address: tokenAddr, abi: erc20Abi, functionName: "balanceOf", args: [effectiveAddress as `0x${string}`] });
        if (!cancelled) setSourceBalance((Number(bal) / 1e6).toString());
      } catch {
        if (!cancelled) setSourceBalance("—");
      }
    })();
    return () => { cancelled = true; };
  }, [sourceKey, address, useCircle, circleWallet, asset, selectedToken]);

  // Token Switch handler
  function handleSelectToken(tok: BridgeToken) {
    setSelectedToken(tok);
    setTokenDropdownOpen(false);
    setAmount("");
    setErrorMsg(null);
    if (step === "done" || step === "error") {
      setStep("idle");
      setBurnTxHash(null);
      setMintTxHash(null);
    }

    if (tok === "USDC") {
      setAsset("usdc");
      if (!CHAINS[sourceKey]) setSourceKey("Ethereum Sepolia");
      if (!CHAINS[destKey] || destKey === sourceKey) setDestKey("Arc Testnet");
    } else if (tok === "EURC") {
      setAsset("eurc");
      const eurcChains = (Object.keys(CHAINS) as ChainKey[]).filter((k) => CCTS_ADDRESS[k]);
      if (!CCTS_ADDRESS[sourceKey]) {
        setSourceKey("Ethereum Sepolia");
        setDestKey("Base Sepolia");
      } else if (!CCTS_ADDRESS[destKey] || destKey === sourceKey) {
        setDestKey(eurcChains.find((k) => k !== sourceKey) ?? "Base Sepolia");
      }
    } else if (tok === "ETH") {
      setSourceKey("Ethereum Sepolia");
      if (destKey !== "Base Sepolia" && destKey !== "Arbitrum Sepolia") {
        setDestKey("Base Sepolia");
      }
    }
  }

  // Available chains based on selected token
  const sourceChains: ChainKey[] =
    selectedToken === "ETH"
      ? ["Ethereum Sepolia"]
      : selectedToken === "EURC"
      ? (Object.keys(CHAINS) as ChainKey[]).filter((k) => CCTS_ADDRESS[k])
      : (Object.keys(CHAINS) as ChainKey[]);

  const destChains: ChainKey[] =
    selectedToken === "ETH"
      ? ["Base Sepolia", "Arbitrum Sepolia"]
      : selectedToken === "EURC"
      ? (Object.keys(CHAINS) as ChainKey[]).filter((k) => CCTS_ADDRESS[k] && k !== sourceKey)
      : (Object.keys(CHAINS) as ChainKey[]).filter((k) => k !== sourceKey);

  function changeSource(key: ChainKey) {
    setSourceKey(key);
    setSourceOpen(false);
    if (key === destKey) {
      const candidates = destChains.filter((k) => k !== key);
      const fallback = candidates[0] ?? (key === "Ethereum Sepolia" ? "Base Sepolia" : "Ethereum Sepolia");
      if (fallback) setDestKey(fallback);
    }
    if (step === "done" || step === "error") { setStep("idle"); setBurnTxHash(null); setMintTxHash(null); setErrorMsg(null); }
  }

  function changeDest(key: ChainKey) {
    setDestKey(key);
    setDestOpen(false);
    if (key === sourceKey) {
      const candidates = sourceChains.filter((k) => k !== key);
      const fallback = candidates[0] ?? (key === "Ethereum Sepolia" ? "Base Sepolia" : "Ethereum Sepolia");
      if (fallback) setSourceKey(fallback);
    }
    if (step === "done" || step === "error") { setStep("idle"); setBurnTxHash(null); setMintTxHash(null); setErrorMsg(null); }
  }

  function flipChains() {
    if (selectedToken === "ETH") return;
    const s = sourceKey, d = destKey;
    setSourceKey(d);
    setDestKey(s);
    if (step === "done" || step === "error") { setStep("idle"); setBurnTxHash(null); setMintTxHash(null); setErrorMsg(null); }
  }

  async function pollAttestation(burnHash: string, domain: number) {
    for (let i = 0; i < 120; i++) {
      try {
        const data = (await irisProxyGet(`/v2/messages/${domain}?transactionHash=${burnHash}`)) as { messages?: { status: string; message: string; attestation: string }[] };
        const msg = data?.messages?.[0];
        if (msg?.status === "complete") return msg as { message: string; attestation: string };
      } catch (e: unknown) {
        const msg = (e as { message?: string })?.message ?? "";
        if (msg.includes("HTTP 404") || msg.includes("HTTP 500")) {
          throw new Error(`${msg} — this looks like our own /api/iris-proxy endpoint failing, not Circle. Check that it's actually deployed.`, { cause: e });
        }
      }
      await new Promise(r => setTimeout(r, 10000));
    }
    throw new Error("Attestation is taking longer than expected. Your funds are safe — the burn is confirmed on-chain. You can mint later using the burn tx hash once Circle finishes attesting.");
  }

  async function doBridgeWithCircle() {
    if (!circleWallet) return;
    if (selectedToken === "EURC" || selectedToken === "ETH") {
      throw new Error(`${selectedToken} bridging via Circle Wallet isn't supported yet — switch to Browser Wallet for ${selectedToken}, or use USDC with Circle Wallet.`);
    }
    const sourceWalletId = getWalletIdForChain(circleWallet, source.circleChain);
    const destWalletId = getWalletIdForChain(circleWallet, dest.circleChain);
    if (!sourceWalletId || !destWalletId) {
      setErrorMsg(`Circle Wallet is missing an account on ${!sourceWalletId ? sourceKey : destKey}.`);
      setStep("error");
      return;
    }
    const tokenAddr = assetAddress(source, asset);
    if (!tokenAddr || !assetAddress(dest, asset)) {
      setErrorMsg(`${assetLabel} isn't deployed on ${!assetAddress(source, asset) ? sourceKey : destKey} yet.`);
      setStep("error");
      return;
    }
    const amountUnits = BigInt(Math.round(Number(amount) * 1e6));

    setStep("approving");
    await circleContractCallAndWait({
      walletId: sourceWalletId,
      contractAddress: tokenAddr,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [TOKEN_MESSENGER, amountUnits.toString()],
    });

    setStep("burning");
    const { maxFee, minFinalityThreshold } = finalityParams(asset);
    const burnHash = await circleContractCallAndWait({
      walletId: sourceWalletId,
      contractAddress: TOKEN_MESSENGER,
      abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)",
      abiParameters: [
        amountUnits.toString(),
        dest.domain,
        bytes32Address(circleWallet.address),
        tokenAddr,
        bytes32Address("0x0000000000000000000000000000000000000000"),
        maxFee.toString(),
        minFinalityThreshold,
      ],
    });
    setBurnTxHash(burnHash);

    setStep("attesting");
    const attestation = await pollAttestation(burnHash, source.domain);

    setStep("minting");
    const mintHash = await circleContractCallAndWait({
      walletId: destWalletId,
      contractAddress: MESSAGE_TRANSMITTER,
      abiFunctionSignature: "receiveMessage(bytes,bytes)",
      abiParameters: [attestation.message, attestation.attestation],
    });
    setMintTxHash(mintHash);
    setStep("done");
    showToast("Bridge completed", "success");
    addPoints(15);
  }

  const [showBridgeConfirm, setShowBridgeConfirm] = useState(false);

  function doBridge() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setErrorMsg("Enter a valid amount."); return;
    }
    if (selectedToken === "ETH") {
      if (sourceKey !== "Ethereum Sepolia") {
        setErrorMsg("ETH deposit can only originate from Ethereum Sepolia."); return;
      }
      if (destKey !== "Base Sepolia" && destKey !== "Arbitrum Sepolia") {
        setErrorMsg("ETH deposit is currently supported to Base Sepolia and Arbitrum Sepolia."); return;
      }
      setErrorMsg(null);
      setShowBridgeConfirm(true);
      return;
    }
    if (sourceKey === destKey) {
      setErrorMsg("Source and destination must be different."); return;
    }
    if (asset === "eurc" && (!CCTS_ADDRESS[sourceKey] || !CCTS_ADDRESS[destKey])) {
      setErrorMsg(`EURC bridging only works between Ethereum Sepolia and Base Sepolia right now — ${!CCTS_ADDRESS[sourceKey] ? sourceKey : destKey} isn't on Circle's CCTPx yet.`); return;
    }
    if (!assetAddress(source, asset) || !assetAddress(dest, asset)) {
      setErrorMsg(`${assetLabel} isn't deployed on ${!assetAddress(source, asset) ? sourceKey : destKey} yet.`); return;
    }
    setErrorMsg(null);
    setShowBridgeConfirm(true);
  }

  async function executeBridge() {
    setShowBridgeConfirm(false);
    setBurnTxHash(null);
    setMintTxHash(null);

    if (useCircle && circleWallet) {
      try {
        await doBridgeWithCircle();
      } catch (e: unknown) {
        setErrorMsg(friendlyError(e));
        setStep("error");
      }
      return;
    }

    try {
      if (selectedToken === "ETH") {
        await doBridgeEth();
      } else if (asset === "eurc") {
        await doBridgeEurcCctpx();
      } else {
        await doBridgeUsdcStandard();
      }
      showToast("Bridge completed", "success");
      addPoints(15);
    } catch (e: unknown) {
      setErrorMsg(friendlyError(e));
      setStep("error");
    }
  }

  async function doBridgeEth() {
    if (useCircle && circleWallet) {
      throw new Error("ETH deposit is only supported via Browser Wallet.");
    }
    await switchChain(provider, "0xaa36a7", addChainParams("Ethereum Sepolia"));
    const sourceWallet = createWalletClient({ chain: sepoliaReliable, transport: custom(provider) });
    const sourcePublic = createPublicClient({ chain: sepoliaReliable, transport: http() });
    const value = parseEther(amount);

    setStep("burning");
    let hash: `0x${string}`;
    if (destKey === "Base Sepolia") {
      hash = await sourceWallet.sendTransaction({ to: BASE_L1_BRIDGE, value, account: address as `0x${string}` });
    } else {
      hash = await sourceWallet.writeContract({
        address: ARBITRUM_INBOX,
        abi: ARBITRUM_INBOX_ABI,
        functionName: "depositEth",
        args: [address as `0x${string}`],
        value,
        account: address as `0x${string}`,
        gas: 300000n,
      });
    }
    const receipt = await sourcePublic.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`ETH deposit transaction reverted (${hash}).`);
    }
    setBurnTxHash(hash);
    setStep("done");
  }

  async function doBridgeUsdcStandard() {
    const tokenAddr = assetAddress(source, asset);
    if (!tokenAddr) throw new Error(`${assetLabel} isn't deployed on ${sourceKey} yet.`);
    const amountUnits = BigInt(Math.round(Number(amount) * 1e6));
    await switchChain(provider, source.chainIdHex, addChainParams(sourceKey));
    const sourceWallet = createWalletClient({ chain: source.chain, transport: custom(provider) });
    const sourcePublic = createPublicClient({ chain: source.chain, transport: http() });

    setStep("approving");
    const approveHash = await sourceWallet.writeContract({
      address: tokenAddr,
      abi: erc20Abi,
      functionName: "approve",
      args: [TOKEN_MESSENGER, amountUnits],
      account: address as `0x${string}`,
    });
    const approveReceipt = await sourcePublic.waitForTransactionReceipt({ hash: approveHash });
    if (approveReceipt.status !== "success") {
      throw new Error(`Approve transaction reverted on-chain (${approveHash}). No funds were moved.`);
    }

    setStep("burning");
    const { maxFee, minFinalityThreshold } = finalityParams(asset);
    const burnArgs = [
      amountUnits,
      dest.domain,
      bytes32Address(address),
      tokenAddr,
      bytes32Address("0x0000000000000000000000000000000000000000"),
      maxFee,
      minFinalityThreshold,
    ] as const;
    try {
      await sourcePublic.simulateContract({
        address: TOKEN_MESSENGER, abi: DEPOSIT_FOR_BURN_ABI, functionName: "depositForBurn",
        args: burnArgs, account: address as `0x${string}`,
      });
    } catch (simErr: unknown) {
      const msg = (simErr as { shortMessage?: string; message?: string })?.shortMessage ?? (simErr as { message?: string })?.message ?? "unknown reason";
      throw new Error(`This burn would fail on-chain (${msg}). Most likely ${assetLabel} isn't registered for CCTP burning on ${sourceKey} yet, even though the token is deployed there. No transaction was sent, no gas spent.`, { cause: simErr });
    }
    const burnHash = await sourceWallet.writeContract({
      address: TOKEN_MESSENGER,
      abi: DEPOSIT_FOR_BURN_ABI,
      functionName: "depositForBurn",
      args: burnArgs,
      account: address as `0x${string}`,
    });
    const burnReceipt = await sourcePublic.waitForTransactionReceipt({ hash: burnHash });
    if (burnReceipt.status !== "success") {
      throw new Error(
        `The burn reverted on-chain (tx ${burnHash.slice(0, 10)}...) — most likely "burn token not supported": ` +
        `${assetLabel} may not be registered for CCTP burning on ${sourceKey} yet, even though the token itself is deployed there. ` +
        `Check the tx on the explorer for the exact revert reason. No funds were moved.`
      );
    }
    setBurnTxHash(burnHash);

    setStep("attesting");
    const attestation = await pollAttestation(burnHash, source.domain);

    setStep("minting");
    await switchChain(provider, dest.chainIdHex, addChainParams(destKey));
    const destWallet = createWalletClient({ chain: dest.chain, transport: custom(provider) });
    const destPublic = createPublicClient({ chain: dest.chain, transport: http() });
    const mintHash = await destWallet.writeContract({
      address: MESSAGE_TRANSMITTER,
      abi: RECEIVE_MESSAGE_ABI,
      functionName: "receiveMessage",
      args: [attestation.message as `0x${string}`, attestation.attestation as `0x${string}`],
      account: address as `0x${string}`,
    });
    const mintReceipt = await destPublic.waitForTransactionReceipt({ hash: mintHash });
    if (mintReceipt.status !== "success") {
      throw new Error(`The mint reverted on-chain (tx ${mintHash.slice(0, 10)}...) on ${destKey}. Your burn is still valid — you can retry minting with the same attestation.`);
    }
    setMintTxHash(mintHash);
    setStep("done");
  }

  async function doBridgeEurcCctpx() {
    const ccts = CCTS_ADDRESS[sourceKey];
    if (!ccts) throw new Error(`EURC (CCTPx) isn't available from ${sourceKey} yet.`);
    await switchChain(provider, source.chainIdHex, addChainParams(sourceKey));
    const sourceWallet = createWalletClient({ chain: source.chain, transport: custom(provider) });
    const sourcePublic = createPublicClient({ chain: source.chain, transport: http() });

    const decimals = 6;
    const amountUnits = BigInt(Math.round(Number(amount) * 10 ** decimals));

    const [tokenManager, tokenAddr] = await Promise.all([
      sourcePublic.readContract({ address: ccts, abi: CCTS_ABI, functionName: "resolveTokenManager", args: [EURC_TOKEN_ID] }),
      sourcePublic.readContract({ address: ccts, abi: CCTS_ABI, functionName: "resolveTokenAddress", args: [EURC_TOKEN_ID] }),
    ]);

    setStep("approving");
    const approveHash = await sourceWallet.writeContract({
      address: tokenAddr, abi: erc20Abi, functionName: "approve", args: [tokenManager, amountUnits], account: address as `0x${string}`,
    });
    const approveReceipt = await sourcePublic.waitForTransactionReceipt({ hash: approveHash });
    if (approveReceipt.status !== "success") {
      throw new Error(`Approve transaction reverted on-chain (${approveHash}). No funds were moved.`);
    }

    try {
      await checkCctpxFastAllowance(EURC_TOKEN_ID, amountUnits, decimals);
    } catch {
      /* proceed */
    }

    setStep("burning");
    const quote = await fetchCctpxQuote(EURC_TOKEN_ID, source.domain, dest.domain, amountUnits);
    const feeTotalAmount = BigInt(quote.feeTotalAmount);
    const destinationAddressPacked = encodePacked(["address"], [address as `0x${string}`]);
    const burnArgs = [
      EURC_TOKEN_ID,
      amountUnits,
      dest.domain,
      destinationAddressPacked,
      bytes32Address("0x0000000000000000000000000000000000000000"),
      1000,
      { signedQuote: quote.signedQuote, refundAddress: zeroAddress },
      false,
      "0x" as `0x${string}`,
    ] as const;
    try {
      await sourcePublic.simulateContract({
        address: ccts, abi: CROSS_CHAIN_TRANSFER_ABI, functionName: "crossChainTransfer",
        args: burnArgs, account: address as `0x${string}`, value: feeTotalAmount,
      });
    } catch (simErr: unknown) {
      const msg = (simErr as { shortMessage?: string; message?: string })?.shortMessage ?? (simErr as { message?: string })?.message ?? "unknown reason";
      throw new Error(`This transfer would fail on-chain (${msg}). No transaction was sent, no gas spent.`, { cause: simErr });
    }
    const burnHash = await sourceWallet.writeContract({
      address: ccts, abi: CROSS_CHAIN_TRANSFER_ABI, functionName: "crossChainTransfer",
      args: burnArgs, account: address as `0x${string}`, value: feeTotalAmount,
    });
    const burnReceipt = await sourcePublic.waitForTransactionReceipt({ hash: burnHash });
    if (burnReceipt.status !== "success") {
      throw new Error(`The transfer reverted on-chain (tx ${burnHash.slice(0, 10)}...). Check the tx on the explorer for the exact reason. No funds were moved.`);
    }
    setBurnTxHash(burnHash);

    setStep("attesting");
    const attestation = await pollAttestation(burnHash, source.domain);

    setStep("minting");
    await switchChain(provider, dest.chainIdHex, addChainParams(destKey));
    const destWallet = createWalletClient({ chain: dest.chain, transport: custom(provider) });
    const destPublic = createPublicClient({ chain: dest.chain, transport: http() });
    const mintHash = await destWallet.writeContract({
      address: MESSAGE_TRANSMITTER,
      abi: RECEIVE_MESSAGE_ABI,
      functionName: "receiveMessage",
      args: [attestation.message as `0x${string}`, attestation.attestation as `0x${string}`],
      account: address as `0x${string}`,
    });
    const mintReceipt = await destPublic.waitForTransactionReceipt({ hash: mintHash });
    if (mintReceipt.status !== "success") {
      throw new Error(`The mint reverted on-chain (tx ${mintHash.slice(0, 10)}...) on ${destKey}. Your transfer is still valid — you can retry minting with the same attestation.`);
    }
    setMintTxHash(mintHash);
    setStep("done");
  }

  const isLoading = step === "approving" || step === "burning" || step === "attesting" || step === "minting";
  const assetLabel = selectedToken === "ETH" ? "ETH" : ASSET_META[asset].label;

  const stepLabels: Record<string, string> = {
    approving: `Approving ${assetLabel} on ${sourceKey}...`,
    burning: selectedToken === "ETH" ? `Depositing ETH to ${destKey}...` : `Burning ${assetLabel} on ${sourceKey}...`,
    attesting: asset === "usdc" ? "Waiting for Circle attestation (can take 1-2 min)..." : "Waiting for Circle attestation — EURC uses Standard Transfer here, this can take several minutes...",
    minting: `Minting ${assetLabel} on ${destKey}...`,
  };
  const stepIndexMap: Record<string, number> = { idle: -1, approving: 1, burning: 1, attesting: 2, minting: 3, done: 4, error: -1 };
  const activeStepIndex = stepIndexMap[step] ?? -1;


  const guideData = HOW_IT_WORKS_DATA[selectedToken];

  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: !isMobile && showHowItWorks ? "1.3fr 1fr" : "1fr",
          gap: "1.25rem",
          alignItems: "start",
          maxWidth: showHowItWorks ? 980 : 560,
          width: "100%",
          transition: "all 0.3s ease",
        }}
      >
        {/* Main Bridge Card */}
        <div
          style={{
            background: "rgba(20, 28, 25, 0.72)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(226, 224, 200, 0.12)",
            borderRadius: 24,
            padding: isMobile ? "1.25rem" : "1.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.2rem",
            boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
          }}
        >
          {/* Card Header with Question Mark Minimize / Open Icon */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#E2E0C8" }}>
                {selectedToken === "ETH" ? "L1 → L2 Bridge" : "Bridge Assets"}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(166, 180, 158, 0.15)",
                  color: "#A6B49E",
                  border: "1px solid rgba(166, 180, 158, 0.25)",
                }}
              >
                {selectedToken}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowHowItWorks((prev) => !prev)}
              title={showHowItWorks ? "Minimize guide" : "How it works"}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "6px 12px",
                borderRadius: 999,
                border: showHowItWorks ? "1px solid #A6B49E" : "1px solid rgba(226, 224, 200, 0.18)",
                background: showHowItWorks ? "rgba(166, 180, 158, 0.22)" : "rgba(15, 20, 19, 0.85)",
                color: showHowItWorks ? "#E2E0C8" : "#A6B49E",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <HelpCircle size={15} />
              <span>How it works</span>
            </button>
          </div>

          {selectedToken === "EURC" && (
            <p style={{ fontSize: 11.5, color: "#A6B49E", margin: 0, background: "rgba(166, 180, 158, 0.1)", border: "1px solid rgba(166, 180, 158, 0.2)", borderRadius: 10, padding: "8px 12px" }}>
              EURC moves through Circle's CCTPx (Expanded Assets), separate from standard USDC bridging — only Ethereum Sepolia ↔ Base Sepolia is supported.
            </p>
          )}

          {selectedToken === "ETH" && (
            <p style={{ fontSize: 11.5, color: "#A6B49E", margin: 0, background: "rgba(166, 180, 158, 0.1)", border: "1px solid rgba(166, 180, 158, 0.2)", borderRadius: 10, padding: "8px 12px" }}>
              Native ETH deposit via official canonical L1→L2 bridge — Ethereum Sepolia to Base Sepolia or Arbitrum Sepolia.
            </p>
          )}

          {/* Chain Selectors */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto 1fr", gap: 10, alignItems: "end" }}>
            <div>
              <label style={{ fontSize: 12, color: "#A6B49E", fontWeight: 600 }}>From</label>
              <div style={{ marginTop: 6 }}>
                <ChainRow
                  isLoading={isLoading}
                  chainKey={sourceKey}
                  open={sourceOpen}
                  setOpen={setSourceOpen}
                  onSelect={changeSource}
                  allowedChains={sourceChains}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={flipChains}
              disabled={isLoading || selectedToken === "ETH"}
              title={selectedToken === "ETH" ? "ETH canonical bridge deposits from L1" : "Flip chains"}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: "rgba(15, 20, 19, 0.8)",
                border: "1px solid rgba(226, 224, 200, 0.15)",
                color: "#E2E0C8",
                cursor: selectedToken === "ETH" ? "not-allowed" : "pointer",
                opacity: selectedToken === "ETH" ? 0.4 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
                flexShrink: 0,
              }}
            >
              <ArrowRight size={15} />
            </button>

            <div>
              <label style={{ fontSize: 12, color: "#A6B49E", fontWeight: 600 }}>To</label>
              <div style={{ marginTop: 6 }}>
                <ChainRow
                  isLoading={isLoading}
                  chainKey={destKey}
                  open={destOpen}
                  setOpen={setDestOpen}
                  onSelect={changeDest}
                  allowedChains={destChains}
                />
              </div>
            </div>
          </div>

          {selectedToken !== "ETH" && !assetAddress(source, asset) && (
            <p style={{ fontSize: 11, color: "#EF4444", margin: 0 }}>{assetLabel} isn't deployed on {sourceKey} yet — pick a different source.</p>
          )}
          {selectedToken !== "ETH" && !assetAddress(dest, asset) && (
            <p style={{ fontSize: 11, color: "#EF4444", margin: 0 }}>{assetLabel} isn't deployed on {destKey} yet — pick a different destination.</p>
          )}

          {/* Amount Box with Dropdown Token Selector */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 12, color: "#A6B49E", fontWeight: 600 }}>Amount</label>
              <span className="prism-mono" style={{ fontSize: 12, color: "#818C78" }}>
                Balance: <span style={{ color: "#E2E0C8", fontWeight: 700 }}>{sourceBalance ?? "..."} {selectedToken}</span>
              </span>
            </div>

            <div style={{ borderRadius: 16, border: "1px solid rgba(226, 224, 200, 0.12)", background: "rgba(12, 17, 15, 0.7)", padding: "1rem 1.1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <input
                  type="number"
                  min="0"
                  step={selectedToken === "ETH" ? "0.001" : "0.01"}
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    boxShadow: "none",
                    fontSize: 30,
                    color: "#E2E0C8",
                    fontWeight: 700,
                    fontFamily: "ui-monospace, monospace",
                  }}
                />

                {/* Token Selector Dropdown */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setTokenDropdownOpen(!tokenDropdownOpen)}
                    disabled={isLoading}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 12px 6px 8px",
                      borderRadius: 999,
                      background: "rgba(226, 224, 200, 0.08)",
                      border: "1px solid rgba(226, 224, 200, 0.18)",
                      cursor: isLoading ? "not-allowed" : "pointer",
                      color: "#E2E0C8",
                      transition: "background 0.2s",
                    }}
                  >
                    <TokenIcon symbol={selectedToken} size={24} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E0C8" }}>{selectedToken}</span>
                    <ChevronDown size={14} color="#A6B49E" />
                  </button>

                  {tokenDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        right: 0,
                        zIndex: 40,
                        background: "rgba(15, 20, 19, 0.98)",
                        backdropFilter: "blur(20px)",
                        border: "1px solid rgba(226, 224, 200, 0.16)",
                        borderRadius: 14,
                        padding: 6,
                        minWidth: 180,
                        boxShadow: "0 16px 36px rgba(0,0,0,0.8)",
                      }}
                    >
                      {BRIDGE_TOKENS.map((tok) => {
                        const isSelected = selectedToken === tok.symbol;
                        return (
                          <button
                            key={tok.symbol}
                            type="button"
                            onClick={() => handleSelectToken(tok.symbol)}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              padding: "8px 10px",
                              borderRadius: 10,
                              background: isSelected ? "rgba(166, 180, 158, 0.15)" : "transparent",
                              border: "none",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <TokenIcon symbol={tok.symbol} size={22} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E0C8" }}>{tok.symbol}</div>
                                <div style={{ fontSize: 10, color: "#818C78" }}>{tok.desc}</div>
                              </div>
                            </div>
                            {isSelected && <Check size={14} color="#A6B49E" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 11, color: "#818C78" }}>
                  {selectedToken === "ETH"
                    ? `Deposit native ETH to ${destKey} rollup`
                    : `Receive native ${selectedToken} on ${destKey} — no wrapped tokens`}
                </span>
                {sourceBalance && sourceBalance !== "—" && (
                  <button
                    type="button"
                    onClick={() => setAmount(sourceBalance)}
                    disabled={isLoading}
                    style={{ background: "none", border: "none", color: "#A6B49E", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, flexShrink: 0 }}
                  >
                    Max
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
            <div style={{ textAlign: "center", background: "rgba(15, 20, 19, 0.7)", border: "1px solid rgba(226, 224, 200, 0.08)", borderRadius: 12, padding: "0.6rem" }}>
              <div style={{ fontSize: 10.5, color: "#818C78" }}>Est. time</div>
              <div className="prism-mono" style={{ fontSize: 13, fontWeight: 700, color: "#E2E0C8" }}>
                {selectedToken === "ETH" ? "~1-3 min" : selectedToken === "EURC" ? "~3-5 min" : "~20 sec"}
              </div>
            </div>
            <div style={{ textAlign: "center", background: "rgba(15, 20, 19, 0.7)", border: "1px solid rgba(226, 224, 200, 0.08)", borderRadius: 12, padding: "0.6rem" }}>
              <div style={{ fontSize: 10.5, color: "#818C78" }}>Network fee</div>
              <div className="prism-mono" style={{ fontSize: 13, fontWeight: 700, color: "#E2E0C8" }}>
                {selectedToken === "ETH" ? "Standard gas" : `0.0005 ${selectedToken}`}
              </div>
            </div>
          </div>

          {/* Stepper Display */}
          {(isLoading || step === "done") && selectedToken !== "ETH" && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {["Approve", "Burn", "Attest", "Mint"].map((label, i) => {
                const isDone = step === "done" || activeStepIndex > i;
                const isActive = activeStepIndex === i && step !== "done";
                const isLast = i === 3;
                return (
                  <div key={label} style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : 1 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, background: isDone ? "#4E635E" : isActive ? "rgba(166, 180, 158, 0.25)" : "rgba(20, 28, 25, 0.7)", border: isDone ? "1px solid #A6B49E" : isActive ? "1px solid #E2E0C8" : "1px solid rgba(226, 224, 200, 0.1)", color: isDone ? "#E2E0C8" : isActive ? "#E2E0C8" : "#818C78" }}>
                        {isDone ? <Check size={12} /> : i + 1}
                      </div>
                      <span style={{ fontSize: 9.5, color: isDone ? "#A6B49E" : isActive ? "#E2E0C8" : "#818C78" }}>{label}</span>
                    </div>
                    {!isLast && <div style={{ height: 2, flex: 1, background: isDone ? "#4E635E" : "rgba(226, 224, 200, 0.1)", marginBottom: 14 }} />}
                  </div>
                );
              })}
            </div>
          )}

          {isLoading && (
            <div style={{ background: "rgba(166, 180, 158, 0.1)", border: "1px solid rgba(166, 180, 158, 0.2)", borderRadius: 12, padding: "0.75rem 1rem" }}>
              <p style={{ fontSize: 13, color: "#E2E0C8", margin: 0 }}>{stepLabels[step]}</p>
            </div>
          )}

          {errorMsg && <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "0.75rem 1rem", color: "#EF4444", fontSize: 13 }}>{errorMsg}</div>}

          {burnTxHash && selectedToken === "ETH" && (
            <div style={{ background: "rgba(78, 99, 94, 0.25)", border: "1px solid rgba(166, 180, 158, 0.3)", borderRadius: 14, padding: "1rem" }}>
              <p style={{ color: "#E2E0C8", fontWeight: 700, marginBottom: 6 }}>ETH deposit submitted!</p>
              <a href={`https://sepolia.etherscan.io/tx/${burnTxHash}`} target="_blank" rel="noopener noreferrer" style={{ color: "#A6B49E", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
                View on Sepolia Etherscan <ExternalLink size={12} />
              </a>
              <p style={{ fontSize: 11, color: "#818C78", marginTop: 8 }}>It may take a few minutes for the L2 sequencer to credit the balance on {destKey}.</p>
            </div>
          )}

          {burnTxHash && selectedToken !== "ETH" && (
            <a href={`${source.chain.blockExplorers?.default.url}/tx/${burnTxHash}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#A6B49E", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
              Burn Tx on {sourceKey} <ExternalLink size={12} />
            </a>
          )}
          {mintTxHash && (
            <div style={{ background: "rgba(78, 99, 94, 0.25)", border: "1px solid rgba(166, 180, 158, 0.3)", borderRadius: 14, padding: "1rem" }}>
              <p style={{ color: "#E2E0C8", fontWeight: 700, marginBottom: 6 }}>Bridge complete!</p>
              <a href={`${dest.chain.blockExplorers?.default.url ?? "https://testnet.arcscan.app"}/tx/${mintTxHash}`} target="_blank" rel="noopener noreferrer" style={{ color: "#A6B49E", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
                View mint on {destKey} <ExternalLink size={12} />
              </a>
            </div>
          )}

          {circleWallet && selectedToken === "USDC" && (
            <div>
              <label style={{ fontSize: 12, color: "#A6B49E", fontWeight: 600 }}>Pay with</label>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button type="button" onClick={() => setUseCircle(false)} disabled={isLoading}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "0.65rem", borderRadius: 12, border: `1.5px solid ${!useCircle ? "#A6B49E" : "rgba(226,224,200,0.12)"}`, background: !useCircle ? "rgba(166,180,158,0.15)" : "rgba(15,20,19,0.7)", color: !useCircle ? "#E2E0C8" : "#818C78", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  <Wallet size={14} /> Browser Wallet
                </button>
                <button type="button" onClick={() => setUseCircle(true)} disabled={isLoading}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "0.65rem", borderRadius: 12, border: `1.5px solid ${useCircle ? "#A6B49E" : "rgba(226,224,200,0.12)"}`, background: useCircle ? "rgba(166,180,158,0.15)" : "rgba(15,20,19,0.7)", color: useCircle ? "#E2E0C8" : "#818C78", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  <CircleDollarSign size={14} /> Circle Wallet
                </button>
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            type="button"
            onClick={step === "error" ? () => { setStep("idle"); setErrorMsg(null); } : doBridge}
            disabled={isLoading || step === "done"}
            style={{
              width: "100%",
              padding: "1.05rem",
              borderRadius: 16,
              border: "none",
              background: "linear-gradient(135deg, #4E635E 0%, #818C78 50%, #A6B49E 100%)",
              color: "#0F1413",
              fontSize: 16,
              fontWeight: 800,
              cursor: isLoading || step === "done" ? "not-allowed" : "pointer",
              opacity: isLoading || step === "done" ? 0.5 : 1,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <ArrowDownUp size={16} />
            {step === "idle" && (selectedToken === "ETH" ? `Deposit ETH to ${destKey}` : `Bridge to ${destKey}`)}
            {isLoading && "Processing..."}
            {step === "done" && "Done!"}
            {step === "error" && "Try Again"}
          </button>

          {showBridgeConfirm && (
            <ConfirmModal
              title={selectedToken === "ETH" ? "Confirm ETH Deposit" : "Confirm Bridge"}
              rows={[
                { label: "Amount", value: `${amount} ${selectedToken}`, highlight: true },
                { label: "From", value: sourceKey },
                { label: "To", value: destKey },
              ]}
              confirmLabel={selectedToken === "ETH" ? "Confirm Deposit" : "Confirm Bridge"}
              onConfirm={executeBridge}
              onCancel={() => setShowBridgeConfirm(false)}
            />
          )}

          {step === "done" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {followUp ? (
                <div style={{ background: "linear-gradient(135deg, #4E635E, #818C78)", borderRadius: 14, padding: "1rem", textAlign: "center", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "relative", fontSize: 12.5, color: "#E2E0C8", marginBottom: 8 }}>
                    Bridge complete. Continuing to swap it to {followUp.toToken}, as requested.
                  </div>
                  <button onClick={() => onNavigate?.("swap")}
                    style={{ position: "relative", width: "100%", padding: "0.65rem", borderRadius: 10, border: "none", background: "#E2E0C8", color: "#0F1413", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                    Continue →
                  </button>
                </div>
              ) : (
                <div style={{ background: "rgba(15, 20, 19, 0.8)", border: "1px solid rgba(226, 224, 200, 0.12)", borderRadius: 14, padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: 12.5, color: "#A6B49E", marginBottom: 8 }}>
                    {asset === "usdc" && destKey === "Arc Testnet"
                      ? "Your USDC just landed on Arc, as native gas — ready to use."
                      : `Your ${selectedToken} just landed on ${destKey} — ready to use.`}
                  </div>
                  <button onClick={() => onNavigate?.("swap")}
                    style={{ width: "100%", padding: "0.65rem", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #4E635E, #A6B49E)", color: "#0F1413", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                    Swap it
                  </button>
                </div>
              )}
              <button onClick={() => { setStep("idle"); setBurnTxHash(null); setMintTxHash(null); setAmount(""); setFollowUp(null); }}
                style={{ width: "100%", padding: "0.75rem", borderRadius: 12, border: "none", background: "transparent", color: "#818C78", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                New Bridge
              </button>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: "#818C78" }}>
            <ShieldCheck size={14} color="#A6B49E" />
            {selectedToken === "ETH" ? "Canonical Rollup Bridge" : "Secured by Circle CCTP v2"}
          </div>
        </div>

        {/* How It Works Card (Opened / Minimized via Question Mark) */}
        {showHowItWorks && (
          <div
            style={{
              background: "rgba(20, 28, 25, 0.72)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(226, 224, 200, 0.12)",
              borderRadius: 24,
              padding: "1.5rem",
              boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#E2E0C8" }}>
                How it works ({selectedToken})
              </div>
              <button
                type="button"
                onClick={() => setShowHowItWorks(false)}
                title="Minimize"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "rgba(15, 20, 19, 0.6)",
                  border: "1px solid rgba(226, 224, 200, 0.12)",
                  color: "#A6B49E",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {guideData.steps.map((s, i) => (
                <div key={s.title} style={{ display: "flex", gap: 10 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "rgba(166, 180, 158, 0.15)",
                      border: "1px solid rgba(166, 180, 158, 0.3)",
                      color: "#E2E0C8",
                      fontSize: 11,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E0C8" }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: "#818C78", marginTop: 2, lineHeight: 1.4 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 11.5, color: "#818C78", lineHeight: 1.6, margin: "14px 0 0 0", paddingTop: 12, borderTop: "1px solid rgba(226, 224, 200, 0.08)" }}>
              <BookOpen size={12} color="#A6B49E" style={{ verticalAlign: -2, marginRight: 4 }} />
              {guideData.footer}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
