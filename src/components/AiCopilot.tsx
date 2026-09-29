import type { JSX } from 'react';
import { useState, useEffect } from "react";
import type { EIP1193Provider } from "viem";
import { createWalletClient, createPublicClient, custom, http, erc20Abi, parseUnits } from "viem";
import { arcTestnet, ARC_CHAIN_ID_HEX } from "../chains";
import { showToast } from "../toast";
import { waitForSuccess } from "../txHelpers";
import { getFormattedMarketAnalysis } from "../marketData";
import { addPoints } from "../gamification";
import { setPendingFollowUp } from "../pendingFollowUp";
import { computeMemoryInsight } from "../memory";
import { USDC_ADDRESS, EURC_ADDRESS, CCTP_TOKEN_MESSENGER as TOKEN_MESSENGER, POOL_USDC_EURC as POOL_ADDRESS } from "../contracts";
import { AlertTriangle, X, Bot, Clock, Check, Maximize2, Minimize2 } from "lucide-react";

const DOMAIN_BY_CHAIN: Record<string, number> = {
  "Ethereum Sepolia": 0,
  "Arbitrum Sepolia": 3,
  "Base Sepolia": 6,
  "Arc Testnet": 26,
};

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

// Known section headers used by getFormattedMarketAnalysis / stablecoin
// format. Any line matching one of these exactly gets rendered as a small
// uppercase section label with a divider, instead of plain text — this is
// what turns the flat analysis string into visually separated "cards"
// without changing the underlying data function.
const ANALYSIS_SECTION_HEADERS = new Set([
  "TIMEFRAME", "KEY LEVELS", "MULTI-TIMEFRAME INSIGHT", "WHAT TO WATCH",
  "Tokenomics", "Token Vesting & Unlocks", "PRICE STABILITY", "STABILITY NOTE", "Supply",
]);

function renderMessageContent(content: string | undefined, expanded: boolean) {
  const lines = (content ?? "").split("\n");
  const nodes: JSX.Element[] = [];
  let i = 0;

  // First line: coin name/symbol, rendered larger.
  if (lines[0]) {
    nodes.push(
      <div key="title" style={{ fontSize: expanded ? 17 : 14, fontWeight: 800, color: "#E2E0C8", marginBottom: 2 }}>
        {lines[0]}
      </div>
    );
    i = 1;
  }
  // Second line: price, rendered largest and bold.
  if (lines[1] && lines[1].startsWith("$")) {
    nodes.push(
      <div key="price" style={{ fontSize: expanded ? 22 : 16, fontWeight: 800, color: "#A6B49E", fontFamily: "ui-monospace, monospace", marginBottom: 2 }}>
        {lines[1]}
      </div>
    );
    i = 2;
  }

  for (; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (ANALYSIS_SECTION_HEADERS.has(trimmed)) {
      nodes.push(
        <div key={i} style={{ marginTop: 10, marginBottom: 2, paddingTop: 8, borderTop: "1px solid rgba(226, 224, 200, 0.12)", fontSize: expanded ? 12 : 11, fontWeight: 800, letterSpacing: 0.6, color: "#A6B49E", textTransform: "uppercase" }}>
          {trimmed}
        </div>
      );
    } else if (trimmed.startsWith("⚠️") || trimmed.startsWith("Warning")) {
      nodes.push(
        <div key={i} style={{ marginTop: 10, fontSize: expanded ? 12 : 10, color: "#818C78", lineHeight: 1.4, display: "flex", alignItems: "center", gap: 5 }}>
          <AlertTriangle size={12} color="#A6B49E" /> {line.replace(/^(?:⚠\uFE0F?|\s)+/u, "")}
        </div>
      );
    } else if (trimmed.length > 0) {
      nodes.push(
        <div key={i} style={{ fontSize: expanded ? 14 : 12.5, color: "#E2E0C8", lineHeight: 1.55 }}>
          {line}
        </div>
      );
    } else {
      nodes.push(<div key={i} style={{ height: 2 }} />);
    }
  }

  return <>{nodes}</>;
}

function bytes32Address(addr: string): `0x${string}` {
  return `0x000000000000000000000000${addr.slice(2)}` as `0x${string}`;
}



const SWAP_ABI = [
  { type: "function", name: "swap", stateMutability: "nonpayable", inputs: [{ name: "aToB", type: "bool" }, { name: "amountIn", type: "uint256" }, { name: "minAmountOut", type: "uint256" }, { name: "deadline", type: "uint256" }], outputs: [{ name: "amountOut", type: "uint256" }] },
  { type: "function", name: "getAmountOut", stateMutability: "view", inputs: [{ name: "aToB", type: "bool" }, { name: "amountIn", type: "uint256" }], outputs: [{ name: "amountOut", type: "uint256" }] },
] as const;

interface Props {
  provider: EIP1193Provider;
  address: string;
  balances: { usdc: string | null; eurc: string | null; usyc: string | null; native: string | null };
  onRefresh: () => void;
  onNavigate: (tab: "bridge") => void;
}

interface Allocation {
  category: "swap_to_eurc" | "idle";
  amount: number;
  percent: number;
  note: string;
}

interface ParsedAction {
  action: "swap" | "send" | "bridge" | "strategy" | "unknown";
  fromToken?: string;
  toToken?: string;
  amount?: number;
  useAllBalance?: boolean;
  recipient?: string;
  destinationChain?: string;
  isLong?: boolean;
  leverage?: number;
  market?: string;
  allocations?: Allocation[];
  followUp?: { action: "swap"; toToken: string }; // for chained requests like "bridge X then swap to Y"
  summary: string;
  reasoning?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  action?: ParsedAction;
  confirmed?: boolean;
}

async function switchToArc(provider: EIP1193Provider) {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_CHAIN_ID_HEX }] });
  } catch (e: unknown) {
    const err = e as { code?: number };
    if (err.code === 4902) {
      await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: ARC_CHAIN_ID_HEX, chainName: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: ["https://rpc.testnet.arc.network"], blockExplorerUrls: ["https://testnet.arcscan.app"] }] });
    } else throw e;
  }
}

export default function AiCopilot({ provider, address, balances, onRefresh, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [memoryText, setMemoryText] = useState<string | null>(null);

  useEffect(() => {
    if (address) computeMemoryInsight(address).then((insight) => setMemoryText(insight?.text ?? null));
  }, [address]);

  async function parseCommand(text: string): Promise<ParsedAction> {
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system: `You are PrismSwap Copilot, a DeFi command parser. Parse the user's natural-language request into STRICT JSON only, no markdown, no preamble.

Schema:
{
  "action": "swap" | "send" | "bridge" | "strategy" | "unknown",
  "fromToken": "USDC" | "EURC" (for swap — this is a fixed-rate USDC/EURC swap only, no other pair is executable here),
  "toToken": "USDC" | "EURC" (for swap — same restriction as fromToken),
  "amount": number (omit if useAllBalance is true),
  "useAllBalance": boolean (true if user says "all my X"),
  "recipient": string (address or .arc name, for send),
  "destinationChain": "Arc Testnet" | "Ethereum Sepolia" | "Base Sepolia" | "Arbitrum Sepolia" (ONLY for send, ONLY if the user names a specific chain the recipient should receive funds on, e.g. "send 50 USDC to 0xABC on Base" — omit entirely if no chain is mentioned, defaulting to a normal same-chain transfer on Arc),
  "allocations": [{ "category": "swap_to_eurc" | "idle", "amount": number, "percent": number, "note": "short reason for this allocation" }] (ONLY for action "strategy"),
  "followUp": { "action": "swap", "toToken": "EURC" } (ONLY for action "bridge", ONLY if the user's request has a clear second step after the bridge, e.g. "bridge 50 USDC to Arc and swap it to EURC" → followUp: {"action":"swap","toToken":"EURC"}. Omit entirely if the user only asked to bridge, with no stated next step.),
  "summary": "short one-line plain-English summary of what will happen",
  "reasoning": "one short sentence on any relevant risk or note"
}

Use "strategy" when the user describes a total amount and asks for a plan, allocation, or strategy (e.g. "I have 500 USDC, give me the safest strategy", "how should I split my USDC"). Allocations must sum to the user's stated amount and only use the two categories above — "swap_to_eurc" diversifies into EURC, "idle" is a deliberate cash reserve. Do not invent other categories (no lending, no LP, no perps) since those require extra parameters this schema doesn't support. A "safest" strategy should favor "idle" over "swap_to_eurc". Explain each allocation's purpose briefly in its "note".

Only USDC and EURC are swappable via this fixed-rate action. If the user asks to swap USYC, ARCC, cirBTC, or any other token, do NOT set fromToken/toToken to that token — set action to "unknown" and explain in summary that this pair isn't supported by the fixed-rate swap, and that they'd need an existing Liquidity Pool for that pair instead (Tools → Liquidity). If the request is otherwise ambiguous or ill-formed, also set action to "unknown" and explain in summary.

Interpret goal-oriented requests, not just literal commands. If the user states an outcome they want rather than a specific mechanism (e.g. "Get me 100 EURC on Arc", "I need 50 USDC", "top up my EURC"), figure out which single supported action gets them there and use that — you do not need the user to say the word "swap" or "bridge" explicitly. As a rule of thumb: wanting a different token they don't currently hold enough of, while already having USDC on Arc, means "swap"; wanting funds moved to a specific external address means "send" (with destinationChain if a chain is named); wanting USDC specifically on a different chain than Arc, with no recipient mentioned, means "bridge". Only fall back to "unknown" if the goal genuinely can't be reached with swap, send, bridge, or strategy.
Available user balances: USDC ${balances.usdc}, EURC ${balances.eurc}.
${memoryText ? `What you know about this user's real recent behavior, from their actual transaction history: ${memoryText} Use this naturally when relevant — for example, weight a "strategy" allocation toward what they already do, or mention it briefly in your reasoning if it's genuinely relevant. Never state this as a fact if it isn't directly implied by the note above, and never fabricate additional behavioral claims beyond it.` : ""}
The "summary" field must be written in the same language the user's message is written in — if they write in Turkish, write the summary in Turkish; if in English, write it in English.
Respond with ONLY the JSON object.`,
        messages: [{ role: "user", content: text }],
      }),
    });
    const data = await response.json();
    if (!data.content) {
      throw new Error(`RAW RESPONSE: ${JSON.stringify(data)}`);
    }
    const raw = data.content?.[0]?.text ?? "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  }

  // For requests that aren't a supported action (market/analysis questions,
  // general chat), answer directly using real live price data instead of
  // just telling the user "not supported" — same no-financial-advice rule
  // as the wallet narrator.
  async function answerGeneralQuestion(text: string): Promise<string> {
    // Try a market/coin analysis first — all numbers come from our own
    // cached backend (api/market-analysis), deterministic and never touched
    // by the AI. Falls through to a plain Claude answer if no coin is found.
    const marketAnswer = await getFormattedMarketAnalysis(text);
    if (marketAnswer) return marketAnswer;

    const response = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 250,
        system: `You are PrismSwap Copilot. The user's message isn't a transaction command and isn't about a specific coin — answer briefly and factually. Never recommend buying, selling, or holding anything. Always respond in the same language the user wrote in.`,
        messages: [{ role: "user", content: text }],
      }),
    });
    const data = await response.json();
    if (!data.content) {
      return `(Error: ${data.error?.message || JSON.stringify(data)})`;
    }
    return data.content?.[0]?.text ?? "I couldn't find an answer to that.";
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const action = await parseCommand(text);
      if (action.action === "unknown") {
        const answer = await answerGeneralQuestion(text);
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      } else {
        const normalizedType = (action.action ?? "").toString().trim().toLowerCase();
        const fallbackSummary =
          normalizedType === "swap" ? `Swap ${action.amount ?? "?"} ${action.fromToken ?? ""} to ${action.toToken ?? ""}` :
          normalizedType === "send" ? `Send ${action.amount ?? "?"} ${action.fromToken ?? "USDC"} to ${action.recipient ?? "recipient"}` :
          normalizedType === "bridge" ? `Bridge ${action.amount ?? "?"} ${action.fromToken ?? "USDC"} to ${action.destinationChain ?? "destination"}` :
          normalizedType === "strategy" ? "Suggested allocation strategy" :
          `Confirm this action (type: "${action.action}")`;
        const summary = action.summary && action.summary.trim() ? action.summary : fallbackSummary;
        setMessages((prev) => [...prev, { role: "assistant", content: summary, action }]);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : JSON.stringify(err);
      setMessages((prev) => [...prev, { role: "assistant", content: `I couldn't complete that: ${detail}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function executeAction(action: ParsedAction, msgIndex: number) {
    setExecuting(true);
    try {
      await switchToArc(provider);
      const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
      const wc = createWalletClient({ chain: arcTestnet, transport: custom(provider) });

      if (action.action === "swap") {
        if (action.fromToken !== "USDC" && action.fromToken !== "EURC") {
          throw new Error(`${action.fromToken ?? "That token"} isn't swappable via the fixed-rate Swap — only USDC/EURC are. For other pairs, use an existing pool under Liquidity Pools.`);
        }
        const amt = action.useAllBalance
          ? (action.fromToken === "USDC" ? balances.usdc : balances.eurc) ?? "0"
          : String(action.amount ?? 0);
        if (Number(amt) <= 0) throw new Error("Invalid amount.");
        const amountIn = parseUnits(amt, 6);
        const tokenAddress = action.fromToken === "USDC" ? USDC_ADDRESS : EURC_ADDRESS;

        const approveHash = await wc.writeContract({ address: tokenAddress, abi: erc20Abi, functionName: "approve", args: [POOL_ADDRESS, amountIn], account: address as `0x${string}` });
        await waitForSuccess(publicClient, approveHash);

        const aToB = action.fromToken === "USDC";
        const freshQuote = await publicClient.readContract({ address: POOL_ADDRESS, abi: SWAP_ABI, functionName: "getAmountOut", args: [aToB, amountIn] }) as bigint;
        const minOut = (freshQuote * 99n) / 100n; // 1% slippage tolerance
        // This runs only after the user confirms the action, never during render.
        // eslint-disable-next-line react-hooks/purity
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

        const hash = await wc.writeContract({
          address: POOL_ADDRESS, abi: SWAP_ABI, functionName: "swap",
          args: [aToB, amountIn, minOut, deadline], account: address as `0x${string}`,
        });
        await waitForSuccess(publicClient, hash);
        showToast("Swap completed", "success");
      } else if (action.action === "send") {
        if (!action.recipient || !action.amount) throw new Error("Missing recipient or amount.");
        const amountUnits = parseUnits(String(action.amount), 6);

        if (action.destinationChain && action.destinationChain !== "Arc Testnet") {
          // Cross-chain send: CCTP lets the minted USDC land directly in someone
          // else's wallet on the destination chain — no manual Bridge tab needed.
          const domain = DOMAIN_BY_CHAIN[action.destinationChain];
          if (domain === undefined) throw new Error(`Unsupported destination chain: ${action.destinationChain}`);

          const approveHash = await wc.writeContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [TOKEN_MESSENGER, amountUnits], account: address as `0x${string}` });
          await waitForSuccess(publicClient, approveHash);

          const burnHash = await wc.writeContract({
            address: TOKEN_MESSENGER, abi: DEPOSIT_FOR_BURN_ABI, functionName: "depositForBurn",
            args: [amountUnits, domain, bytes32Address(action.recipient), USDC_ADDRESS, bytes32Address("0x0000000000000000000000000000000000000000"), 500n, 1000],
            account: address as `0x${string}`,
          });
          await waitForSuccess(publicClient, burnHash);
          showToast(`USDC sent to ${action.recipient.slice(0, 6)}...${action.recipient.slice(-4)} on ${action.destinationChain} — it will arrive once Circle attests the transfer (usually 1-2 min).`, "info");
        } else {
          const tokenAddress = action.fromToken === "EURC" ? EURC_ADDRESS : USDC_ADDRESS;
          const hash = await wc.writeContract({ address: tokenAddress, abi: erc20Abi, functionName: "transfer", args: [action.recipient as `0x${string}`, amountUnits], account: address as `0x${string}` });
          await waitForSuccess(publicClient, hash);
          showToast("Send completed", "success");
        }
      } else if (action.action === "bridge") {
        if (action.followUp) setPendingFollowUp(action.followUp);
        onNavigate("bridge");
        const followUpMsg = action.followUp
          ? ` Once it lands, I'll bring you straight to swap it to ${action.followUp.toToken}.`
          : "";
        setMessages((prev) => [...prev, { role: "assistant", content: `Bridging needs a network switch, so I've taken you to the Bridge tab — pick your source chain and confirm there.${followUpMsg}` }]);
        setExecuting(false);
        return;
      } else if (action.action === "strategy") {
        if (!action.allocations || action.allocations.length === 0) throw new Error("No allocation plan to execute.");
        for (const alloc of action.allocations) {
          if (alloc.category === "idle" || alloc.amount <= 0) continue;
          const amountUnits = parseUnits(String(alloc.amount), 6);

          if (alloc.category === "swap_to_eurc") {
            const approveHash = await wc.writeContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [POOL_ADDRESS, amountUnits], account: address as `0x${string}` });
            await waitForSuccess(publicClient, approveHash);
            const stratQuote = await publicClient.readContract({ address: POOL_ADDRESS, abi: SWAP_ABI, functionName: "getAmountOut", args: [true, amountUnits] }) as bigint;
            const stratMinOut = (stratQuote * 99n) / 100n;
            // Read the deadline at execution time after approval completes.
            // eslint-disable-next-line react-hooks/purity
            const stratDeadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
            const hash = await wc.writeContract({ address: POOL_ADDRESS, abi: SWAP_ABI, functionName: "swap", args: [true, amountUnits, stratMinOut, stratDeadline], account: address as `0x${string}` });
            await waitForSuccess(publicClient, hash);
          }
        }
        showToast("Strategy executed", "success");
        addPoints(25);
      }

      setMessages((prev) => prev.map((m, i) => i === msgIndex ? { ...m, confirmed: true } : m));
      onRefresh();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setMessages((prev) => [...prev, { role: "assistant", content: `Failed: ${err.message ?? "Unexpected error."}` }]);
    } finally {
      setExecuting(false);
    }
  }

  return (
    <>
      {expanded && open && (
        <div onClick={() => setExpanded(false)} style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.35)", zIndex: 998 }} />
      )}
      <div style={expanded
        ? { position: "fixed", top: 16, right: 16, bottom: 16, zIndex: 999 }
        : { position: "fixed", bottom: 24, right: 24, zIndex: 999 }}>
      {open && (
        <div style={expanded
          ? { width: "min(560px, calc(100vw - 32px))", height: "100%", background: "rgba(16, 23, 20, 0.95)", backdropFilter: "blur(25px)", border: "1px solid rgba(226, 224, 200, 0.15)", borderRadius: 24, boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7)", display: "flex", flexDirection: "column", overflow: "hidden" }
          : { width: 380, maxHeight: 520, background: "rgba(16, 23, 20, 0.95)", backdropFilter: "blur(25px)", border: "1px solid rgba(226, 224, 200, 0.15)", borderRadius: 24, boxShadow: "0 20px 60px rgba(0, 0, 0, 0.7)", display: "flex", flexDirection: "column", marginBottom: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: expanded ? "1.2rem 1.5rem" : "1rem 1.25rem", background: "rgba(78, 99, 94, 0.12)", borderBottom: "1px solid rgba(226, 224, 200, 0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: expanded ? 32 : 26, height: expanded ? 32 : 26, borderRadius: 9, background: "linear-gradient(135deg, #4E635E, #818C78)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: expanded ? 15 : 12, color: "#E2E0C8" }}>✦</div>
              <div>
                <span style={{ fontSize: expanded ? 17 : 14, fontWeight: 800, color: "#E2E0C8" }}>Prism AI Copilot</span>
                <span style={{ display: "block", fontSize: 10, color: "#A6B49E", fontWeight: 700 }}>AUTONOMOUS AGENT</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setExpanded(!expanded)} title={expanded ? "Shrink" : "Expand"}
                style={{ background: "rgba(226, 224, 200, 0.08)", border: "none", borderRadius: 8, color: "#E2E0C8", cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button onClick={() => { setOpen(false); setExpanded(false); }} style={{ background: "none", border: "none", color: "#818C78", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: expanded ? "1.5rem" : "1.1rem", display: "flex", flexDirection: "column", gap: expanded ? 14 : 10, minHeight: expanded ? undefined : 220, maxHeight: expanded ? undefined : 340 }}>
            {messages.length === 0 && (
              <div style={{ fontSize: 12.5, color: "#818C78", lineHeight: 1.6 }}>
                Try: "Get me 100 EURC on Arc", "What is the best pool APY right now?", or "Transfer 25 USDC across CCTP".
                {memoryText && (
                  <div style={{ marginTop: 12, background: "rgba(78, 99, 94, 0.15)", border: "1px solid rgba(166, 180, 158, 0.2)", borderRadius: 12, padding: "0.75rem 0.9rem", color: "#E2E0C8", fontSize: 11.5, display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={13} color="#A6B49E" /> {memoryText}
                  </div>
                )}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: m.role === "user" ? "88%" : "100%" }}>
                <div style={{
                  background: m.role === "user" ? "linear-gradient(135deg, #4E635E 0%, #818C78 100%)" : "rgba(10, 15, 13, 0.65)",
                  border: m.role === "user" ? "none" : "1px solid rgba(226, 224, 200, 0.08)",
                  borderRadius: 14, padding: expanded ? "0.9rem 1.1rem" : "0.7rem 0.9rem", color: "#E2E0C8",
                }}>
                  {m.role === "assistant" ? renderMessageContent(m.content, expanded) : <span style={{ fontSize: expanded ? 15 : 13.5 }}>{m.content}</span>}
                </div>
                {m.action && m.action.action !== "unknown" && !m.confirmed && (
                  <div style={{ marginTop: 8, background: "rgba(10, 15, 13, 0.85)", border: "1px solid rgba(166, 180, 158, 0.2)", borderRadius: 14, padding: "0.85rem 1rem" }}>
                    {m.action.reasoning && <p style={{ fontSize: 11.5, color: "#818C78", margin: "0 0 8px 0" }}>{m.action.reasoning}</p>}
                    <button onClick={() => executeAction(m.action!, i)} disabled={executing}
                      style={{ width: "100%", padding: "0.65rem", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #4E635E, #818C78, #A6B49E)", color: "#0F1614", fontSize: 12.5, fontWeight: 700, cursor: executing ? "not-allowed" : "pointer", opacity: executing ? 0.6 : 1 }}>
                      {executing ? "Executing on Arc..." : m.action.action === "strategy" ? "Execute Strategy" : "Confirm Operation"}
                    </button>
                  </div>
                )}
                {m.confirmed && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#A6B49E", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                    <Check size={12} /> Operation Confirmed
                  </div>
                )}
              </div>
            ))}
            {loading && <div style={{ fontSize: 12, color: "#A6B49E" }}>Prism AI analyzing...</div>}
          </div>

          <div style={{ display: "flex", gap: 8, padding: expanded ? "1.2rem 1.5rem" : "0.9rem 1.1rem", borderTop: "1px solid rgba(226, 224, 200, 0.06)", background: "rgba(10, 15, 13, 0.6)" }}>
            <input type="text" placeholder="Command Prism Copilot..." value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              disabled={loading}
              style={{ flex: 1, background: "rgba(226, 224, 200, 0.04)", border: "1px solid rgba(226, 224, 200, 0.1)", borderRadius: 12, padding: expanded ? "0.9rem 1.1rem" : "0.65rem 0.9rem", fontSize: expanded ? 15 : 13, color: "#E2E0C8", outline: "none" }} />
            <button onClick={handleSend} disabled={loading || !input.trim()}
              style={{ padding: expanded ? "0.9rem 1.5rem" : "0.65rem 1.1rem", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #4E635E, #818C78, #A6B49E)", color: "#0F1614", fontSize: expanded ? 15 : 13, fontWeight: 700, cursor: loading || !input.trim() ? "not-allowed" : "pointer", opacity: loading || !input.trim() ? 0.6 : 1 }}>
              Send
            </button>
          </div>
        </div>
      )}

      {!expanded && (
        <button onClick={() => setOpen(!open)}
          style={{
            width: 56, height: 56, borderRadius: "50%", border: "1px solid rgba(226, 224, 200, 0.25)",
            background: "linear-gradient(135deg, #4E635E 0%, #818C78 100%)", color: "#E2E0C8", fontSize: 22, cursor: "pointer",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          {open ? <X size={20} /> : <Bot size={20} />}
        </button>
      )}
      </div>
    </>
  );
}
