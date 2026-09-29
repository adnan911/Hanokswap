import { useState, useEffect, type ReactNode } from "react";
import type { EIP1193Provider } from "viem";
import { ExternalLink, ArrowRight, RefreshCw, ShieldCheck, Coins, Inbox, Copy } from "lucide-react";
import EmptyState from "./EmptyState";
import NetworkGuard from "./NetworkGuard";
import { useIsMobile } from "../useIsMobile";
import { USDC_LOGO, EURC_LOGO } from "./tokenLogos";
import { TYPE_ICON, loadLifiDiamond, metaFor, amountCell, assetOf, counterpartOf, shortHash, fetchActivity, type Tx } from "./txUtils";
import Sparkline from "./Sparkline";
import { usePortfolio, money, type MainnetBalances } from "./usePortfolio";
import { showToast } from "../toast";
import { useLanguage } from "../LanguageContext";

interface Props {
  address: string;
  balances: MainnetBalances;
  provider?: EIP1193Provider;
  onNavigate?: (tab: string) => void;
}

function Donut({ segments, size = 132, thickness = 14, children }: { segments: { value: number; color: string }[]; size?: number; thickness?: number; children?: ReactNode }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const offset = segments.slice(0, i).reduce((sum, segment) => sum + segment.value, 0) / total * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${Math.max(len - (segments.length > 1 ? 2 : 0), 0)} ${c}`} strokeDashoffset={-offset} strokeLinecap="butt" />
          );
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>{children}</div>
    </div>
  );
}

const card = { background: "var(--card)", backdropFilter: "blur(20px)", border: "1px solid var(--border)", borderRadius: 22, boxShadow: "0 16px 40px rgba(0,0,0,0.3)" } as const;
const kpiLabel = { display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--muted-foreground)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" } as const;
const bigNum = { fontSize: 28, fontWeight: 800, color: "var(--foreground)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px" } as const;

export default function DashboardMainnet({ address, balances, provider, onNavigate }: Props) {
  const isMobile = useIsMobile();
  const { t, language } = useLanguage();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [, setTxCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [diamond, setDiamond] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLifiDiamond().then((d) => { if (!cancelled) setDiamond(d); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const all = await fetchActivity(address, "mainnet", 100);
        if (cancelled) return;
        setTxCount(all.length);
        setTxs(all.slice(0, 20));
        setUpdatedAt(Date.now());
      } catch {
        if (cancelled) return;
        setTxCount(null);
        setTxs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (address) load();
    return () => { cancelled = true; };
  }, [address, reloadKey]);

  const { total, distribution, top, topPct, chartPoints, hasChart, change } = usePortfolio(address, balances);

  const mixCounts: Record<string, { count: number; color: string }> = {};
  for (const tx of txs) {
    const m = metaFor(tx, address, diamond);
    mixCounts[m.label] = { count: (mixCounts[m.label]?.count ?? 0) + 1, color: m.color };
  }
  const mix = Object.entries(mixCounts).map(([label, v]) => ({ label, value: v.count, color: v.color, pct: (v.count / (txs.length || 1)) * 100 })).sort((a, b) => b.value - a.value);

  let incoming = 0, sent = 0;
  for (const tx of txs) {
    const label = metaFor(tx, address, diamond).label;
    if (label === "Receive") incoming++;
    if (label === "Send") sent++;
  }

  const recent = txs.slice(0, 6);
  const updatedText = updatedAt === null ? "—" : Math.floor((now - updatedAt) / 60000) < 1 ? (language === "ko" ? "방금 전" : "just now") : `${Math.floor((now - updatedAt) / 60000)}${language === "ko" ? "분 전" : "m ago"}`;

  const assetChip = (sym: string | null) => {
    if (!sym) return <span style={{ color: "var(--muted-foreground)" }}>—</span>;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 700, color: "var(--foreground)" }}>
        {sym === "USDC" || sym === "EURC"
          ? <img src={sym === "USDC" ? USDC_LOGO : EURC_LOGO} alt="" width={20} height={20} style={{ width: 20, height: 20, borderRadius: "50%" }} />
          : <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--muted)", color: "var(--foreground)", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{sym.slice(0, 1)}</span>}
        {sym}
      </span>
    );
  };

  const TABLE_GRID = "112px 110px 120px minmax(150px, 1fr) 84px 60px";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <NetworkGuard provider={provider} />

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1.25fr 1fr 1fr 1fr", gap: "1rem" }}>
        <div style={{ ...card, padding: "1.25rem 1.4rem", gridColumn: isMobile ? "1 / -1" : undefined }}>
          <div style={kpiLabel}>{t.totalNetWorth}</div>
          <div className="prism-mono" style={{ ...bigNum, fontSize: 34, marginTop: 6 }}>${money(total)}</div>
          <div style={{ marginTop: 8, minHeight: 44 }}>
            {hasChart ? <Sparkline points={chartPoints} color="var(--primary)" /> : <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", paddingTop: 10 }}>{language === "ko" ? "거래가 시작되면 차트가 생성됩니다." : "Chart builds as you trade."}</div>}
          </div>
          {hasChart && <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", textAlign: "right", marginTop: 2 }}>{chartPoints.length} {language === "ko" ? "일간" : "days"}</div>}
        </div>

        <div style={{ ...card, padding: "1.25rem 1.4rem" }}>
          <div style={kpiLabel}>{language === "ko" ? "보유 USDC" : "Available USDC"}</div>
          <div className="prism-mono" style={{ ...bigNum, marginTop: 6 }}>{balances.usdc ?? "…"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
            <img src={USDC_LOGO} alt="" width={26} height={26} style={{ width: 26, height: 26, borderRadius: "50%" }} /> USDC
          </div>
        </div>

        <div style={{ ...card, padding: "1.25rem 1.4rem" }}>
          <div style={kpiLabel}>{language === "ko" ? "보유 EURC" : "Available EURC"}</div>
          <div className="prism-mono" style={{ ...bigNum, marginTop: 6 }}>{balances.eurc ?? "…"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
            <img src={EURC_LOGO} alt="" width={26} height={26} style={{ width: 26, height: 26, borderRadius: "50%" }} /> EURC
          </div>
        </div>

        <div style={{ ...card, padding: "1.25rem 1.4rem", gridColumn: isMobile ? "1 / -1" : undefined }}>
          <div style={kpiLabel}>{language === "ko" ? "7일간 변동" : "7-day change"}</div>
          {change ? (
            <>
              <div className="prism-mono" style={{ ...bigNum, marginTop: 6, color: change.abs >= 0 ? "var(--primary)" : "#EF4444" }}>
                {change.abs >= 0 ? "+" : "−"}${money(Math.abs(change.abs))}
              </div>
              <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: change.abs >= 0 ? "var(--primary)" : "#EF4444" }}>
                {change.abs >= 0 ? "▲" : "▼"} {Math.abs(change.pct).toFixed(1)}%
              </div>
            </>
          ) : (
            <>
              <div className="prism-mono" style={{ ...bigNum, marginTop: 6, color: "var(--muted-foreground)" }}>—</div>
              <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: "var(--muted-foreground)" }}>{language === "ko" ? "내역 데이터 수집 중" : "Not enough history"}</div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
        <div style={{ ...card, padding: "1.4rem" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)", marginBottom: 14 }}>{t.portfolioBreakdown}</div>
          {total === 0 ? (
            <EmptyState icon={<Coins size={26} color="var(--primary)" />} title={language === "ko" ? "보유 자산이 없습니다" : "No balances yet"} subtitle={language === "ko" ? "토큰을 스왑하거나 브릿지하여 시작하세요" : "Bridge or swap tokens to get started"} />
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                <Donut segments={distribution.map((d) => ({ value: d.value, color: d.color }))}>
                  <div className="prism-mono" style={{ fontSize: 24, fontWeight: 800, color: "var(--foreground)" }}>{Math.round(topPct)}%</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>{top?.label}</div>
                </Donut>
                <div style={{ flex: 1, minWidth: 150, display: "flex", flexDirection: "column", gap: 10 }}>
                  {distribution.map((d) => (
                    <div key={d.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--foreground)", fontWeight: 600 }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: d.color }} />{d.label}
                      </span>
                      <span style={{ textAlign: "right" }}>
                        <span className="prism-mono" style={{ display: "block", fontWeight: 700, color: "var(--foreground)" }}>${money(d.value)}</span>
                        <span className="prism-mono" style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)" }}>{((d.value / total) * 100).toFixed(1)}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ ...card, padding: "1.4rem" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)", marginBottom: 14 }}>{language === "ko" ? "트랜잭션 유형별 분포" : "Activity mix"}</div>
          {mix.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", padding: "1.5rem 0" }}>{loading ? t.loading : (language === "ko" ? "트랜잭션 내역이 없습니다." : "No transactions yet.")}</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                <Donut segments={mix.map((m) => ({ value: m.value, color: m.color }))}>
                  <div className="prism-mono" style={{ fontSize: 24, fontWeight: 800, color: "var(--foreground)" }}>{txs.length}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>{language === "ko" ? "최근 내역" : "recent tx"}</div>
                </Donut>
                <div style={{ flex: 1, minWidth: 150, display: "flex", flexDirection: "column", gap: 10 }}>
                  {mix.map((m) => (
                    <div key={m.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--foreground)", fontWeight: 600 }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: m.color }} />{m.label}
                      </span>
                      <span className="prism-mono" style={{ fontWeight: 700, color: "var(--foreground)" }}>{m.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: "1.1rem 1.4rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)" }}>{t.recentActivity}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--primary)" }}>{loading ? "…" : incoming} {language === "ko" ? "수신" : "incoming"}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted-foreground)" }}>{loading ? "…" : sent} {language === "ko" ? "전송" : "sent"}</span>
          </div>
          {onNavigate && (
            <button onClick={() => onNavigate("mainnethistory")}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--primary)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {t.viewAll} <ArrowRight size={15} />
            </button>
          )}
        </div>

        {loading && <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", padding: "0 1.4rem 1.4rem" }}>{t.loading}</div>}
        {!loading && recent.length === 0 && <div style={{ padding: "0 1.4rem 1.4rem" }}><EmptyState icon={<Inbox size={26} color="var(--primary)" />} title={language === "ko" ? "트랜잭션 내역이 없습니다" : "No transactions yet"} subtitle={language === "ko" ? "최근 활동이 여기에 표시됩니다" : "Your recent activity will show up here"} /></div>}

        {recent.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 640 }}>
              <div style={{ display: "grid", gridTemplateColumns: TABLE_GRID, gap: 10, padding: "0.65rem 1.4rem", background: "var(--muted)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", fontSize: 10.5, color: "var(--muted-foreground)", fontWeight: 700, letterSpacing: "0.6px" }}>
                <span>{t.type}</span><span>{t.asset}</span><span style={{ textAlign: "right", paddingRight: 14 }}>{t.amount}</span><span>{language === "ko" ? "보낸이 / 받는이" : "FROM / TO"}</span><span>{t.date}</span><span style={{ textAlign: "right" }}>TX</span>
              </div>
              {recent.map((tx) => {
                const meta = metaFor(tx, address, diamond);
                const amt = amountCell(tx, address);
                return (
                  <div key={tx.hash} style={{ display: "grid", gridTemplateColumns: TABLE_GRID, gap: 10, alignItems: "center", padding: "0.8rem 1.4rem", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "var(--foreground)", background: "var(--muted)", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: 8, width: "fit-content" }}>
                      {TYPE_ICON[meta.label]}{meta.label}
                    </span>
                    {assetChip(assetOf(tx))}
                    <span style={{ textAlign: "right", paddingRight: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", fontFamily: "ui-monospace, 'JetBrains Mono', monospace", color: amt ? (amt.tone === "in" ? "var(--primary)" : "var(--foreground)") : "var(--muted-foreground)" }}>{amt ? amt.text.replace(/ [A-Z]+$/, "") : "—"}</span>
                    <span style={{ color: "var(--muted-foreground)", fontFamily: "ui-monospace, 'JetBrains Mono', monospace", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{counterpartOf(tx, address)}</span>
                    <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{tx.age}</span>
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                      <button onClick={() => { navigator.clipboard.writeText(tx.hash); showToast(t.addressCopied, "success"); }} title="Copy hash"
                        style={{ background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer", display: "flex", padding: 0 }}>
                        <Copy size={13} />
                      </button>
                      <a href={`https://etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" title={shortHash(tx.hash)}
                        style={{ display: "flex", color: "var(--primary)" }}><ExternalLink size={14} /></a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "0.85rem 1.4rem", background: "var(--muted)", borderTop: recent.length > 0 ? "none" : "1px solid var(--border)", fontSize: 12, color: "var(--muted-foreground)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><ShieldCheck size={14} color="var(--primary)" /> {language === "ko" ? "멀티체인 검증 실시간 지표" : "Multi-chain verified live metrics"}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {language === "ko" ? "마지막 업데이트" : "Last updated"}: {updatedText}
            <button onClick={() => setReloadKey((k) => k + 1)} title={t.refresh} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2, color: "var(--primary)" }}><RefreshCw size={14} /></button>
          </span>
        </div>
      </div>
    </div>
  );
}
