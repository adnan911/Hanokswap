import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

export interface ArcToken { address: string; symbol: string; logoURI?: string; }

// Tokens that exist on Arc, from LI.FI's public token list (the app already talks to li.quest).
// Looked up once per chain and cached. This is a list of what's available on Arc, not a popularity ranking.
const cache = new Map<number, Promise<ArcToken[]>>();
function loadArcTokens(chainId: number): Promise<ArcToken[]> {
  let p = cache.get(chainId);
  if (!p) {
    p = fetch(`https://li.quest/v1/tokens?chains=${chainId}`)
      .then((r) => r.json())
      .then((d) => {
        const raw: ArcToken[] = d?.tokens?.[chainId] ?? d?.tokens?.[String(chainId)] ?? [];
        const seen = new Set<string>();
        const list = raw.filter((t) => {
          if (!t?.symbol || !t.logoURI || seen.has(t.symbol)) return false;
          seen.add(t.symbol);
          return true;
        });
        // USDC first (Arc's native asset), then EURC, the rest in LI.FI's order.
        const rank = (t: ArcToken) => (t.symbol === "USDC" ? 0 : t.symbol === "EURC" ? 1 : 2);
        list.sort((a, b) => rank(a) - rank(b));
        return list.slice(0, 12);
      })
      .catch(() => []);
    cache.set(chainId, p);
  }
  return p;
}

export default function ArcTokenStrip({ chainId, label = "On Arc", onPick, initialSelected }: { chainId: number; label?: string; onPick: (t: ArcToken) => void; initialSelected?: string }) {
  const [tokens, setTokens] = useState<ArcToken[]>([]);
  const [selected, setSelected] = useState<string | null>(initialSelected?.toLowerCase() ?? null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadArcTokens(chainId).then((t) => { if (!cancelled) setTokens(t); });
    return () => { cancelled = true; };
  }, [chainId]);

  if (tokens.length === 0) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "var(--card)",
      border: "1px solid var(--border)",
      boxShadow: "var(--shadow-xs)",
      borderRadius: 12,
      padding: "9px 10px 9px 14px",
      marginBottom: 10
    }}>
      <span style={{
        display: "flex",
        alignItems: "center",
        fontSize: 12.5,
        fontWeight: 700,
        color: "var(--text-secondary)",
        flexShrink: 0
      }}>
        {label}
      </span>
      <div ref={scroller} style={{ display: "flex", gap: 8, overflowX: "auto", flex: 1, scrollbarWidth: "none" }}>
        {tokens.map((t) => {
          const on = selected === t.address.toLowerCase();
          return (
            <button key={t.address} type="button" onClick={() => { setSelected(t.address.toLowerCase()); onPick(t); }}
              className={on ? "bridge-tab-active keep-white" : ""}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                flexShrink: 0,
                padding: "4px 12px 4px 6px",
                borderRadius: 999,
                background: on
                  ? "linear-gradient(135deg, var(--primary), oklch(0.75 0.15 45))"
                  : "var(--muted)",
                border: on
                  ? "1px solid var(--primary)"
                  : "1px solid var(--border)",
                boxShadow: on ? "0 2px 8px oklch(0.6724 0.1308 38.7559 / 0.3)" : "none",
                cursor: "pointer",
                transition: "all 0.15s"
              }}>
              <img src={t.logoURI} alt="" width={22} height={22} onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
              <span className={on ? "keep-white" : ""} style={{
                fontSize: 13,
                fontWeight: 800,
                color: on ? "#FFFFFF" : "var(--foreground)"
              }}>
                {t.symbol}
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" aria-label="Scroll tokens" onClick={() => scroller.current?.scrollBy({ left: 180, behavior: "smooth" })}
        style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 2, flexShrink: 0 }}>
        <ChevronRight size={18} color="var(--text-secondary)" />
      </button>
    </div>
  );
}
