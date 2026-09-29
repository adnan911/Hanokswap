import { useState, useEffect } from "react";
import EmptyState from "./EmptyState";
import { useIsMobile } from "../useIsMobile";
import { Coins, Inbox } from "lucide-react";

interface Props {
  address: string;
  balances: { usdc: string | null; eurc: string | null; usyc: string | null; cirbtc: string | null; native: string | null };
}

interface ActivityItem {
  hash: string;
  age: string;
  amount: string;
  category: "income" | "expense" | "bridge" | "swap" | "supply" | "withdraw" | "deposit" | "borrow" | "repay" | "position" | "pool" | "token" | "other";
}

const METHOD_CATEGORY: Record<string, "income" | "expense" | "bridge" | "swap" | "supply" | "withdraw" | "deposit" | "borrow" | "repay" | "position" | "pool" | "token" | "other"> = {
  "0xa9059cbb": "expense",  // transfer
  "0x095ea7b3": "other",    // approve
  "0x74b30078": "swap",     // swapUsdcToEurc
  "0x3eb4812c": "swap",     // swapEurcToUsdc
  "0x08c84c21": "swap",     // Pool V2 swap(bool,uint256,uint256)
  "0x9cd441da": "swap",     // legacy AMM swap variant
  "0x35403023": "supply",   // supply(uint256)
  "0x2e1a7d4d": "withdraw", // withdraw(uint256)
  "0xbad4a01f": "deposit",  // depositCollateral(uint256)
  "0xc5ebeaec": "borrow",   // borrow(uint256)
  "0x371fd8e6": "repay",    // repay(uint256)
  "0x5e1a7dde": "position", // openPosition(...)
  "0x2d6ce61d": "position", // closePosition(uint256,uint256)
  "0x884db063": "pool",     // createPool(...)
  "0x5b060530": "token",    // createToken(...)
  "0x6fd3504e": "bridge",   // depositForBurn (CCTP)
  "0xe334e8dd": "other",    // escrow
};

function timeAgo(sec: number) {
  const diff = Math.floor(Date.now() / 1000) - sec;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadSnapshot(key: string): { date: string; value: number } | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSnapshot(key: string, date: string, value: number) {
  try {
    localStorage.setItem(key, JSON.stringify({ date, value }));
  } catch {
    /* ignore */
  }
}

function loadWeekSnapshot(address: string): { weekStart: string; value: number } | null {
  try {
    const raw = localStorage.getItem(`flowfi-portfolio-week-${address}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function Dashboard({ address, balances }: Props) {
  const isMobile = useIsMobile();
  const [txCount, setTxCount] = useState<number | null>(null);
  const [incomingCount, setIncomingCount] = useState(0);
  const [outgoingCount, setOutgoingCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [activityBreakdown, setActivityBreakdown] = useState<{ label: string; pct: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyChange, setDailyChange] = useState<{ pct: number; hasData: boolean }>({ pct: 0, hasData: false });
  const [weeklyChange, setWeeklyChange] = useState<{ pct: number; hasData: boolean }>({ pct: 0, hasData: false });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/arcscan-proxy?module=account&action=txlist&address=${address}&limit=100`);
        const data = await res.json();
        const txs = data.result ?? [];
        setTxCount(txs.length);

        let inCount = 0, outCount = 0;
        const activity: ActivityItem[] = txs.slice(0, 20).map((tx: any) => {
          const isIncoming = tx.to?.toLowerCase() === address.toLowerCase() && tx.from?.toLowerCase() !== address.toLowerCase();
          const isOutgoing = tx.from?.toLowerCase() === address.toLowerCase();
          let category: ActivityItem["category"] = METHOD_CATEGORY[tx.methodId] ?? "other";
          if (category === "expense" && isIncoming) category = "income";
          if (isIncoming) inCount++;
          if (isOutgoing && tx.methodId === "0xa9059cbb") outCount++;

          let amount = "";
          if (tx.methodId === "0xa9059cbb" && tx.input && tx.input.length >= 138) {
            const amountHex = tx.input.slice(-64);
            const val = parseInt(amountHex, 16) / 1e6;
            if (!isNaN(val) && val < 1e9) amount = val.toFixed(2);
          }

          return {
            hash: tx.hash,
            age: tx.timeStamp ? timeAgo(Number(tx.timeStamp)) : "—",
            amount,
            category,
          };
        });
        setIncomingCount(inCount);
        setOutgoingCount(outCount);
        setRecentActivity(activity.slice(0, 6));

        // Activity breakdown by type, using the fuller 20-tx sample rather
        // than just the 6 shown in "Recent Activity" — a more representative slice.
        const breakdownCounts: Record<string, number> = {};
        for (const tx of txs.slice(0, 20)) {
          let label = "Other";
          if (tx.methodId === "0x74b30078" || tx.methodId === "0x9cd441da") label = "Swap";
          else if (tx.methodId === "0x8e0250ee" || tx.methodId === "0x57ecfd28") label = "Bridge";
          else if (tx.methodId === "0xa9059cbb") label = "Send";
          else if (tx.methodId === "0x095ea7b3") label = "Approve";
          breakdownCounts[label] = (breakdownCounts[label] ?? 0) + 1;
        }
        const total20 = txs.slice(0, 20).length;
        const colors: Record<string, string> = { Swap: "#E2E0C8", Bridge: "#A6B49E", Send: "#818C78", Approve: "#4E635E", Other: "rgba(226, 224, 200, 0.4)" };
        const breakdown = Object.entries(breakdownCounts)
          .map(([label, count]) => ({ label, pct: total20 > 0 ? (count / total20) * 100 : 0, color: colors[label] ?? "rgba(226, 224, 200, 0.4)" }))
          .sort((a, b) => b.pct - a.pct);
        setActivityBreakdown(breakdown);
      } catch {
        setTxCount(null);
        setRecentActivity([]);
      } finally {
        setLoading(false);
      }
    }
    if (address) load();
  }, [address]);

  const [btcUsd, setBtcUsd] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/coingecko-proxy?path=" + encodeURIComponent("/simple/price?ids=bitcoin&vs_currencies=usd"))
      .then(r => r.json())
      .then(d => setBtcUsd(d?.bitcoin?.usd ?? null))
      .catch(() => setBtcUsd(null));
  }, []);

  const usdcVal = Number(balances.usdc ?? 0);
  const eurcVal = Number(balances.eurc ?? 0);
  const usycVal = Number(balances.usyc ?? 0);
  const cirbtcVal = btcUsd !== null ? Number(balances.cirbtc ?? 0) * btcUsd : 0;
  const total = usdcVal + eurcVal + usycVal + cirbtcVal;

  // Track daily + weekly portfolio snapshots in localStorage — real data, accumulates from today onward.
  useEffect(() => {
    if (!address || total === 0) return;
    const today = todayKey();
    const dayKey = `flowfi-portfolio-snapshot-${address}`;
    const snap = loadSnapshot(dayKey);
    if (!snap) {
      saveSnapshot(dayKey, today, total);
      setDailyChange({ pct: 0, hasData: false });
    } else if (snap.date === today) {
      setDailyChange({ pct: 0, hasData: false });
    } else {
      const pct = snap.value > 0 ? ((total - snap.value) / snap.value) * 100 : 0;
      setDailyChange({ pct, hasData: true });
      saveSnapshot(dayKey, today, total);
    }

    // Weekly snapshot: store a value once per calendar week (ISO week start = Monday)
    const now = new Date();
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    const weekKey = monday.toISOString().slice(0, 10);

    const weekSnap = loadWeekSnapshot(address);
    if (!weekSnap) {
      localStorage.setItem(`flowfi-portfolio-week-${address}`, JSON.stringify({ weekStart: weekKey, value: total }));
      setWeeklyChange({ pct: 0, hasData: false });
    } else if (weekSnap.weekStart === weekKey) {
      const pct = weekSnap.value > 0 ? ((total - weekSnap.value) / weekSnap.value) * 100 : 0;
      setWeeklyChange({ pct, hasData: weekSnap.value !== total });
    } else {
      localStorage.setItem(`flowfi-portfolio-week-${address}`, JSON.stringify({ weekStart: weekKey, value: total }));
      setWeeklyChange({ pct: 0, hasData: false });
    }
  }, [address, total]);

  const distribution = [
    { label: "USDC", value: usdcVal, color: "#E2E0C8" },
    { label: "EURC", value: eurcVal, color: "#A6B49E" },
    { label: "USYC", value: usycVal, color: "#818C78" },
    { label: "cirBTC", value: cirbtcVal, color: "#4E635E" },
  ].filter(d => d.value > 0);

  const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
    income: { label: "Income", color: "#E2E0C8", bg: "rgba(226,224,200,0.15)" },
    expense: { label: "Sent", color: "#818C78", bg: "rgba(129,140,120,0.15)" },
    bridge: { label: "Bridge", color: "#A6B49E", bg: "rgba(166,180,158,0.15)" },
    swap: { label: "Swap", color: "#E2E0C8", bg: "rgba(226,224,200,0.15)" },
    supply: { label: "Supply", color: "#A6B49E", bg: "rgba(166,180,158,0.15)" },
    withdraw: { label: "Withdraw", color: "#818C78", bg: "rgba(129,140,120,0.15)" },
    deposit: { label: "Deposit Collateral", color: "#E2E0C8", bg: "rgba(226,224,200,0.15)" },
    borrow: { label: "Borrow", color: "#818C78", bg: "rgba(129,140,120,0.15)" },
    repay: { label: "Repay", color: "#A6B49E", bg: "rgba(166,180,158,0.15)" },
    position: { label: "Perps", color: "#4E635E", bg: "rgba(78,99,94,0.2)" },
    pool: { label: "Liquidity Pool", color: "#A6B49E", bg: "rgba(166,180,158,0.15)" },
    token: { label: "Token Launch", color: "#E2E0C8", bg: "rgba(226,224,200,0.15)" },
    other: { label: "Activity", color: "#818C78", bg: "rgba(129,140,120,0.15)" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Hero: Net Worth & Prism Portfolio */}
      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg, rgba(28, 38, 34, 0.9) 0%, rgba(15, 20, 19, 0.95) 100%)", border: "1px solid rgba(226, 224, 200, 0.18)", borderRadius: 24, padding: "2rem", boxShadow: "0 20px 48px rgba(0, 0, 0, 0.7), 0 0 30px rgba(78, 99, 94, 0.2)" }}>
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "#A6B49E", fontWeight: 800, letterSpacing: "1.5px" }}>PORTFOLIO VALUATION</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#E2E0C8", background: "rgba(166, 180, 158, 0.15)", border: "1px solid rgba(166, 180, 158, 0.3)", padding: "3px 10px", borderRadius: 999 }}>LIVE SYNC</span>
          </div>
          <div className="prism-mono" style={{ fontSize: 44, fontWeight: 900, color: "#E2E0C8", marginBottom: 10, letterSpacing: "-1px" }}>${total.toFixed(2)}</div>

          <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#A6B49E" }}>Today</span>
              {dailyChange.hasData ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: dailyChange.pct >= 0 ? "#E2E0C8" : "#818C78" }}>
                  {dailyChange.pct >= 0 ? "▲" : "▼"} {Math.abs(dailyChange.pct).toFixed(1)}%
                </span>
              ) : (
                <span style={{ fontSize: 12, color: "#818C78" }}>Tracking...</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#A6B49E" }}>This Week</span>
              {weeklyChange.hasData ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: weeklyChange.pct >= 0 ? "#E2E0C8" : "#818C78" }}>
                  {weeklyChange.pct >= 0 ? "▲" : "▼"} {Math.abs(weeklyChange.pct).toFixed(1)}%
                </span>
              ) : (
                <span style={{ fontSize: 12, color: "#818C78" }}>Tracking...</span>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ background: "rgba(15, 20, 19, 0.75)", border: "1px solid rgba(226, 224, 200, 0.08)", borderRadius: 16, padding: "1rem 1.1rem" }}>
              <div style={{ fontSize: 10, color: "#E2E0C8", fontWeight: 800, letterSpacing: "1px", marginBottom: 4 }}>AVAILABLE USDC</div>
              <div className="prism-mono" style={{ fontSize: 20, color: "#E2E0C8", fontWeight: 800 }}>{balances.usdc ?? "..."}</div>
            </div>
            <div style={{ background: "rgba(15, 20, 19, 0.75)", border: "1px solid rgba(226, 224, 200, 0.08)", borderRadius: 16, padding: "1rem 1.1rem" }}>
              <div style={{ fontSize: 10, color: "#A6B49E", fontWeight: 800, letterSpacing: "1px", marginBottom: 4 }}>AVAILABLE EURC</div>
              <div className="prism-mono" style={{ fontSize: 20, color: "#E2E0C8", fontWeight: 800 }}>{balances.eurc ?? "..."}</div>
            </div>
            <div style={{ background: "rgba(15, 20, 19, 0.75)", border: "1px solid rgba(226, 224, 200, 0.08)", borderRadius: 16, padding: "1rem 1.1rem" }}>
              <div style={{ fontSize: 10, color: "#818C78", fontWeight: 800, letterSpacing: "1px", marginBottom: 4 }}>AVAILABLE CIRBTC</div>
              <div className="prism-mono" style={{ fontSize: 20, color: "#E2E0C8", fontWeight: 800 }}>{balances.cirbtc ?? "..."}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Allocation */}
      <div style={{ background: "rgba(20, 28, 25, 0.75)", backdropFilter: "blur(20px)", border: "1px solid rgba(226, 224, 200, 0.12)", borderRadius: 20, padding: "1.5rem", boxShadow: "0 12px 36px rgba(0, 0, 0, 0.5)" }}>
        <div style={{ fontSize: 11, color: "#A6B49E", fontWeight: 800, letterSpacing: "1.2px", marginBottom: 14 }}>ASSET DISTRIBUTION</div>
        {total === 0 ? (
          <EmptyState icon={<Coins size={26} color="#A6B49E" />} title="No assets deposited" subtitle="Get free testnet USDC from Circle faucet to begin" actionLabel="Get Circle USDC" actionHref="https://faucet.circle.com" />
        ) : (
          <>
            <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", marginBottom: 14, background: "rgba(226, 224, 200, 0.06)" }}>
              {distribution.map((d) => (
                <div key={d.label} style={{ width: `${(d.value / total) * 100}%`, background: d.color }} />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {distribution.map((d) => (
                <div key={d.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, boxShadow: `0 0 6px ${d.color}` }} />
                    <span style={{ color: "#E2E0C8", fontWeight: 600 }}>{d.label}</span>
                  </div>
                  <span className="prism-mono" style={{ color: "#E2E0C8", fontWeight: 700 }}>{((d.value / total) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Activity Breakdown */}
      {activityBreakdown.length > 0 && (
        <div style={{ background: "rgba(20, 28, 25, 0.75)", backdropFilter: "blur(20px)", border: "1px solid rgba(226, 224, 200, 0.12)", borderRadius: 20, padding: "1.5rem", boxShadow: "0 12px 36px rgba(0, 0, 0, 0.5)" }}>
          <div style={{ fontSize: 11, color: "#A6B49E", fontWeight: 800, letterSpacing: "1.2px", marginBottom: 14 }}>ACTIVITY BREAKDOWN</div>
          <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", marginBottom: 14, background: "rgba(226, 224, 200, 0.06)" }}>
            {activityBreakdown.map((b) => (
              <div key={b.label} style={{ width: `${b.pct}%`, background: b.color }} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activityBreakdown.map((b) => (
              <div key={b.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, boxShadow: `0 0 6px ${b.color}` }} />
                  <span style={{ color: "#E2E0C8", fontWeight: 600 }}>{b.label}</span>
                </div>
                <span className="prism-mono" style={{ color: "#E2E0C8", fontWeight: 700 }}>{b.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#818C78", marginTop: 12, marginBottom: 0 }}>Aggregated across your recent on-chain transactions.</p>
        </div>
      )}

      {/* Activity Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "0.75rem" }}>
        <div style={{ background: "rgba(20, 28, 25, 0.75)", border: "1px solid rgba(226, 224, 200, 0.12)", borderRadius: 16, padding: "1.1rem 1.25rem" }}>
          <div className="prism-mono" style={{ fontSize: 22, fontWeight: 800, color: "#E2E0C8" }}>{loading ? "..." : incomingCount}</div>
          <div style={{ fontSize: 11.5, color: "#A6B49E", marginTop: 2 }}>Incoming Transfers</div>
        </div>
        <div style={{ background: "rgba(20, 28, 25, 0.75)", border: "1px solid rgba(226, 224, 200, 0.12)", borderRadius: 16, padding: "1.1rem 1.25rem" }}>
          <div className="prism-mono" style={{ fontSize: 22, fontWeight: 800, color: "#818C78" }}>{loading ? "..." : outgoingCount}</div>
          <div style={{ fontSize: 11.5, color: "#A6B49E", marginTop: 2 }}>Sent Transactions</div>
        </div>
        <div style={{ background: "rgba(20, 28, 25, 0.75)", border: "1px solid rgba(226, 224, 200, 0.12)", borderRadius: 16, padding: "1.1rem 1.25rem" }}>
          <div className="prism-mono" style={{ fontSize: 22, fontWeight: 800, color: "#A6B49E" }}>{loading ? "..." : txCount ?? 0}</div>
          <div style={{ fontSize: 11.5, color: "#A6B49E", marginTop: 2 }}>Total Settled Ops</div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div style={{ background: "rgba(20, 28, 25, 0.75)", backdropFilter: "blur(20px)", border: "1px solid rgba(226, 224, 200, 0.12)", borderRadius: 20, padding: "1.5rem", boxShadow: "0 12px 36px rgba(0, 0, 0, 0.5)" }}>
        <div style={{ fontSize: 11, color: "#A6B49E", fontWeight: 800, letterSpacing: "1.2px", marginBottom: 14 }}>RECENT TRANSACTIONS</div>
        {loading && <div style={{ fontSize: 13, color: "#A6B49E" }}>Querying Arc node activity...</div>}
        {!loading && recentActivity.length === 0 && <EmptyState icon={<Inbox size={26} color="#A6B49E" />} title="No transaction history" subtitle="Your activity will populate automatically upon trading" />}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recentActivity.map((tx) => {
            const meta = CATEGORY_META[tx.category];
            return (
              <a key={tx.hash} href={`https://testnet.arcscan.app/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", borderRadius: 14, background: "rgba(15, 20, 19, 0.7)", border: "1px solid rgba(226, 224, 200, 0.08)", textDecoration: "none", transition: "all 0.15s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: meta.color, background: meta.bg, border: `1px solid ${meta.color}40`, padding: "3px 9px", borderRadius: 8 }}>{meta.label}</span>
                  {tx.amount && <span className="prism-mono" style={{ fontSize: 13, color: "#E2E0C8", fontWeight: 600 }}>${tx.amount}</span>}
                </div>
                <span style={{ fontSize: 12, color: "#818C78" }}>{tx.age}</span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
