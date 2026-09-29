import EmptyState from "./EmptyState";
import { HelpCircle, Copy, ExternalLink, RefreshCw, Check, CheckCircle2, Clock, XCircle, ListFilter, Inbox } from "lucide-react";
import { useState, useEffect } from "react";
import { TYPE_ICON, loadLifiDiamond, shortHash, metaFor, describeTx, amountCell, fetchActivity, type Tx } from "./txUtils";
import { useLanguage } from "../LanguageContext";

interface Props {
  address: string;
  network?: "testnet" | "mainnet";
}

const GRID = "108px minmax(220px, 1fr) 130px 108px 74px 78px";

export default function TxHistory({ address }: Props) {
  const { t, language } = useLanguage();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [diamond, setDiamond] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLifiDiamond().then((d) => { if (!cancelled) setDiamond(d); });
    return () => { cancelled = true; };
  }, []);

  async function load() {
    if (!address) return;
    setLoading(true); setError(null);
    try {
      setTxs(await fetchActivity(address, "mainnet", 30));
    } catch {
      setError(language === "ko" ? "트랜잭션을 불러올 수 없습니다. 블록 탐색기가 일시적으로 응답하지 않을 수 있습니다." : "Could not load transactions — explorer may be temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (address) load(); }, [address]);

  function copyHash(hash: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1500);
  }

  const filterOptions = ["all", "Send", "Receive", "Swap", "Route", "Bridge", "Approve"];
  const filteredTxs = filter === "all" ? txs : txs.filter((tx) => metaFor(tx, address, diamond).label === filter);

  const statusOf = (s: string) => ({
    ok: { label: t.success, color: "var(--primary)", icon: <CheckCircle2 size={15} /> },
    pending: { label: t.pending, color: "var(--muted-foreground)", icon: <Clock size={15} /> },
    error: { label: t.failed, color: "#DC2626", icon: <XCircle size={15} /> },
  }[s] ?? { label: t.pending, color: "var(--muted-foreground)", icon: <Clock size={15} /> });

  const card = { background: "var(--card)", border: "1px solid var(--border)", backdropFilter: "blur(16px)", borderRadius: 18, boxShadow: "0 16px 40px rgba(0,0,0,0.3)" } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
        {language === "ko" ? "멀티체인 트랜잭션 활동:" : "Multi-chain transaction activity for"}{" "}
        <span className="prism-mono" style={{ color: "var(--foreground)", fontWeight: 700 }}>{address.slice(0, 6)}...{address.slice(-4)}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {filterOptions.map((f) => {
            const on = filter === f;
            const filterLabel = f === "all" ? t.all : f === "Send" ? (language === "ko" ? "전송" : "Send") : f === "Receive" ? (language === "ko" ? "수신" : "Receive") : f === "Swap" ? t.swap : f === "Bridge" ? t.bridge : f;
            return (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 12, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  border: on ? "1px solid var(--primary)" : "1px solid var(--border)",
                  background: on ? "var(--primary)" : "var(--muted)",
                  color: on ? "#FFFFFF" : "var(--muted-foreground)",
                  boxShadow: on ? "0 4px 12px oklch(0.6724 0.1308 38.7559 / 0.3)" : "none",
                  transition: "all 0.15s",
                }}>
                {f === "all" ? <ListFilter size={13} /> : TYPE_ICON[f]}
                {filterLabel}
              </button>
            );
          })}
        </div>
        <button onClick={load}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "7px 14px", color: "var(--foreground)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          <RefreshCw size={13} /> {t.refresh}
        </button>
      </div>

      {loading && (
        <div style={{ ...card, overflow: "hidden" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "1rem 1.1rem", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
              <div style={{ width: 70, height: 22, borderRadius: 8, background: "var(--muted)" }} />
              <div style={{ flex: 1, height: 12, borderRadius: 6, background: "var(--muted)" }} />
              <div style={{ width: 60, height: 12, borderRadius: 6, background: "var(--muted)" }} />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div style={{ ...card, padding: "2.5rem 1.5rem", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <HelpCircle size={22} color="var(--primary)" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}>{language === "ko" ? "트랜잭션을 불러올 수 없습니다" : "Could not load transactions"}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginBottom: 16 }}>{error}</div>
          <button onClick={load} style={{ background: "var(--primary)", border: "none", borderRadius: 10, padding: "0.6rem 1.4rem", color: "#FFFFFF", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>↻ {language === "ko" ? "다시 시도" : "Try again"}</button>
        </div>
      )}

      {!loading && !error && filteredTxs.length === 0 && (
        <EmptyState icon={<Inbox size={28} color="var(--primary)" />} title={language === "ko" ? "트랜잭션 내역이 없습니다" : "No transactions yet"} subtitle={language === "ko" ? "하옥스왑에서 스왑과 브릿지를 시작하면 내역이 여기에 표시됩니다" : "Your activity will show up here once you start swapping and bridging on HanokSwap"} />
      )}

      {!loading && filteredTxs.length > 0 && (
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ overflow: "auto", maxHeight: "70vh" }}>
            <div style={{ minWidth: 720 }}>
              <div style={{ position: "sticky", top: 0, zIndex: 2, display: "grid", gridTemplateColumns: GRID, gap: 10, padding: "0.75rem 1.1rem", background: "var(--muted)", borderBottom: "1px solid var(--border)", fontSize: 10.5, color: "var(--muted-foreground)", fontWeight: 700, letterSpacing: "0.6px" }}>
                <span>{t.type}</span>
                <span>{language === "ko" ? "상세 정보" : "DETAILS"}</span>
                <span style={{ textAlign: "right" }}>{t.amount}</span>
                <span>{t.status}</span>
                <span style={{ textAlign: "right" }}>{t.date}</span>
                <span style={{ textAlign: "right" }}>{language === "ko" ? "동작" : "ACTIONS"}</span>
              </div>
              {filteredTxs.map((tx) => {
                const meta = metaFor(tx, address, diamond);
                const st = statusOf(tx.status);
                const amt = amountCell(tx, address);
                const amtColor = amt?.tone === "in" ? "var(--primary)" : "var(--foreground)";
                return (
                  <div key={tx.hash}
                    style={{ display: "grid", gridTemplateColumns: GRID, gap: 10, alignItems: "center", padding: "0.85rem 1.1rem", borderTop: "1px solid var(--border)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: meta.color, background: `${meta.color}1a`, border: `1px solid ${meta.color}33`, padding: "4px 10px", borderRadius: 8, width: "fit-content" }}>
                      {TYPE_ICON[meta.label]}{meta.label}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, color: "var(--foreground)", fontWeight: 500, lineHeight: 1.4 }}>{describeTx(tx, address, "mainnet", diamond)}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{shortHash(tx.hash)} · {tx.age}</span>
                    </span>
                    <span style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: amt ? amtColor : "var(--muted-foreground)", fontVariantNumeric: "tabular-nums", fontFamily: "'JetBrains Mono', monospace" }}>
                      {amt ? amt.text : "—"}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: st.color }}>
                      {st.icon}{st.label}
                    </span>
                    <span style={{ textAlign: "right", fontSize: 12, color: "var(--muted-foreground)" }}>{tx.age}</span>
                    <span style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                      <button onClick={(e) => copyHash(tx.hash, e)} title="Copy hash"
                        style={{ width: 30, height: 30, borderRadius: 9, border: "1px solid var(--border)", background: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: copiedHash === tx.hash ? "var(--primary)" : "var(--muted-foreground)" }}>
                        {copiedHash === tx.hash ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <a href={`https://etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" title="Open in explorer"
                        style={{ width: 30, height: 30, borderRadius: 9, border: "1px solid var(--border)", background: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)" }}>
                        <ExternalLink size={14} />
                      </a>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
