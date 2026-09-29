import type { JSX } from "react";
import { useState } from "react";
import { getFormattedMarketAnalysis } from "../marketData";
import { AlertTriangle, Zap, Bot, X, Check, Maximize2, Minimize2 } from "lucide-react";

const ANALYSIS_SECTION_HEADERS = new Set([
  "TIMEFRAME", "KEY LEVELS", "MULTI-TIMEFRAME INSIGHT", "WHAT TO WATCH",
  "Tokenomics", "Token Vesting & Unlocks", "PRICE STABILITY", "STABILITY NOTE", "Supply",
]);

function renderMessageContent(content: string | undefined, expanded: boolean) {
  const lines = (content ?? "").split("\n");
  const nodes: JSX.Element[] = [];
  let i = 0;
  if (lines[0]) {
    nodes.push(<div key="title" style={{ fontSize: expanded ? 17 : 14, fontWeight: 800, color: "var(--foreground)", marginBottom: 2 }}>{lines[0]}</div>);
    i = 1;
  }
  if (lines[1] && lines[1].startsWith("$")) {
    nodes.push(<div key="price" style={{ fontSize: expanded ? 22 : 16, fontWeight: 800, color: "var(--primary)", fontFamily: "ui-monospace, monospace", marginBottom: 2 }}>{lines[1]}</div>);
    i = 2;
  }
  for (; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (ANALYSIS_SECTION_HEADERS.has(trimmed)) {
      nodes.push(<div key={i} style={{ marginTop: 10, marginBottom: 2, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: expanded ? 12 : 11, fontWeight: 800, letterSpacing: 0.6, color: "var(--primary)", textTransform: "uppercase" }}>{trimmed}</div>);
    } else if (trimmed.startsWith("⚠️") || trimmed.startsWith("Warning")) {
      nodes.push(
        <div key={i} style={{ marginTop: 10, fontSize: expanded ? 12 : 10, color: "var(--muted-foreground)", lineHeight: 1.4, display: "flex", alignItems: "center", gap: 5 }}>
          <AlertTriangle size={12} color="var(--primary)" /> {line.replace(/^(?:⚠\uFE0F?|\s)+/u, "")}
        </div>
      );
    } else if (trimmed.length > 0) {
      nodes.push(<div key={i} style={{ fontSize: expanded ? 14 : 12.5, color: "var(--foreground)", lineHeight: 1.55 }}>{line}</div>);
    } else {
      nodes.push(<div key={i} style={{ height: 2 }} />);
    }
  }
  return <>{nodes}</>;
}

type MainnetTab = "mainnetbridge" | "mainnetswap";

interface Props {
  onNavigate: (tab: MainnetTab) => void;
}

interface ParsedIntent {
  action: "bridge" | "swap" | "unknown";
  summary: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  intent?: ParsedIntent;
  confirmed?: boolean;
}

async function parseIntent(text: string): Promise<ParsedIntent> {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      system: `You are HanokSwap Copilot, an AI assistant for HanokSwap multi-chain DEX & cross-chain aggregator. Recognize whether the user wants to (a) bridge/move tokens between chains, (b) swap tokens on a chain, or (c) neither. Respond with STRICT JSON only:
{"action": "bridge" | "swap" | "unknown", "summary": "one short plain-English sentence describing what they want"}`,
      messages: [{ role: "user", content: text }],
    }),
  });
  const data = await response.json();
  if (!data.content) throw new Error(`RAW RESPONSE: ${JSON.stringify(data)}`);
  const raw = data.content?.[0]?.text ?? "{}";
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

async function answerGeneralQuestion(text: string): Promise<string> {
  const marketAnswer = await getFormattedMarketAnalysis(text);
  if (marketAnswer) return marketAnswer;
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 250,
      system: `You are HanokSwap Copilot. Answer briefly and factually about decentralized finance, token swapping, cross-chain bridging, and market mechanics. Never recommend buying, selling, or holding anything. Always respond in the language the user wrote in.`,
      messages: [{ role: "user", content: text }],
    }),
  });
  const data = await response.json();
  if (!data.content) return `(Error: ${data.error?.message || JSON.stringify(data)})`;
  return data.content?.[0]?.text ?? "I couldn't find an answer to that.";
}

export default function AiCopilotMainnet({ onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const intent = await parseIntent(text);
      if (intent.action === "unknown") {
        const answer = await answerGeneralQuestion(text);
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: intent.summary, intent }]);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : JSON.stringify(err);
      setMessages((prev) => [...prev, { role: "assistant", content: `I couldn't complete that: ${detail}` }]);
    } finally {
      setLoading(false);
    }
  }

  function goToPage(intent: ParsedIntent, msgIndex: number) {
    const targetTab: MainnetTab = intent.action === "bridge" ? "mainnetbridge" : "mainnetswap";
    onNavigate(targetTab);
    const pageLabel = intent.action === "bridge" ? "Bridge" : "Swap";
    setMessages((prev) => [
      ...prev.map((m, i) => (i === msgIndex ? { ...m, confirmed: true } : m)),
      { role: "assistant", content: `I've opened the ${pageLabel} tab for you — select your tokens and confirm with your wallet.` },
    ]);
    setOpen(true);
  }

  return (
    <>
      {expanded && open && (
        <div onClick={() => setExpanded(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", zIndex: 998 }} />
      )}
      <div style={expanded
        ? { position: "fixed", top: 16, right: 16, bottom: 16, zIndex: 999 }
        : { position: "fixed", bottom: 24, right: 24, zIndex: 999 }}>
      {open && (
        <div style={expanded
          ? { width: "min(560px, calc(100vw - 32px))", height: "100%", background: "var(--card)", backdropFilter: "blur(20px)", border: "1px solid var(--border)", borderRadius: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", overflow: "hidden" }
          : { width: 360, maxHeight: 480, background: "var(--card)", backdropFilter: "blur(20px)", border: "1px solid var(--border)", borderRadius: 24, boxShadow: "0 16px 48px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", marginBottom: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: expanded ? "1.1rem 1.4rem" : "0.9rem 1.1rem", background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: expanded ? 30 : 24, height: expanded ? 30 : 24, borderRadius: 8, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF" }}>
                <Zap size={expanded ? 16 : 13} />
              </div>
              <span style={{ fontSize: expanded ? 16 : 13, fontWeight: 800, color: "var(--foreground)" }}>Hanok AI Copilot</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setExpanded(!expanded)} title={expanded ? "Shrink" : "Expand"}
                style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button onClick={() => { setOpen(false); setExpanded(false); }} style={{ background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: expanded ? "1.4rem" : "1rem", display: "flex", flexDirection: "column", gap: expanded ? 14 : 10, minHeight: expanded ? undefined : 200, maxHeight: expanded ? undefined : 320 }}>
            {messages.length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                Try asking: "Bridge USDC from Arbitrum to Base", "Swap ETH for USDC", or "What is current ETH momentum?".
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: m.role === "user" ? "90%" : "100%" }}>
                <div style={{
                  background: m.role === "user" ? "var(--primary)" : "var(--muted)",
                  border: m.role === "user" ? "none" : "1px solid var(--border)",
                  borderRadius: 14, padding: expanded ? "0.9rem 1.1rem" : "0.6rem 0.8rem", color: m.role === "user" ? "#FFFFFF" : "var(--foreground)",
                  fontWeight: m.role === "user" ? 700 : 500,
                }}>
                  {m.role === "assistant" ? renderMessageContent(m.content, expanded) : <span style={{ fontSize: expanded ? 15 : 13 }}>{m.content}</span>}
                </div>
                {m.intent && m.intent.action !== "unknown" && !m.confirmed && (
                  <div style={{ marginTop: 6, background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "0.7rem 0.8rem" }}>
                    <button onClick={() => goToPage(m.intent!, i)}
                      style={{ width: "100%", padding: "0.55rem", borderRadius: 10, border: "none", background: "var(--primary)", color: "#FFFFFF", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                      Take me there
                    </button>
                  </div>
                )}
                {m.confirmed && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                    <Check size={12} /> Redirected
                  </div>
                )}
              </div>
            ))}
            {loading && <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Thinking...</div>}
          </div>

          <div style={{ display: "flex", gap: 8, padding: expanded ? "1.2rem 1.4rem" : "0.9rem", borderTop: "1px solid var(--border)" }}>
            <input type="text" placeholder="Ask Hanok AI anything..." value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              disabled={loading}
              style={{ flex: 1, background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: expanded ? "0.9rem 1.1rem" : "0.6rem 0.8rem", fontSize: expanded ? 15 : 13, color: "var(--foreground)", outline: "none" }} />
            <button onClick={handleSend} disabled={loading || !input.trim()}
              style={{ padding: expanded ? "0.9rem 1.4rem" : "0.6rem 1rem", borderRadius: 12, border: "none", background: "var(--primary)", color: "#FFFFFF", fontSize: expanded ? 15 : 13, fontWeight: 800, cursor: loading || !input.trim() ? "not-allowed" : "pointer", opacity: loading || !input.trim() ? 0.6 : 1 }}>
              Send
            </button>
          </div>
        </div>
      )}

      {!expanded && (
        <button onClick={() => setOpen(!open)}
          style={{
            width: 54, height: 54, borderRadius: "50%", border: "none",
            background: "var(--primary)", color: "#FFFFFF", fontSize: 20, cursor: "pointer",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          {open ? <X size={20} /> : <Bot size={20} />}
        </button>
      )}
      </div>
    </>
  );
}
