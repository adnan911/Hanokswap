import { useState, useEffect } from "react";
import { calculateKimchiPremium, formatKrw, type KimchiPremiumData } from "../lib/upbitKimchi";

interface Coin {
  id: string;
  symbol: string;
  price: number;
  change24h: number;
}

const TRACKED_COINS = ["bitcoin", "ethereum", "solana", "usd-coin", "ripple"];
const SYMBOL_MAP: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  "usd-coin": "USDC",
  ripple: "XRP",
};

export default function MarketTicker() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [kimchi, setKimchi] = useState<KimchiPremiumData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [coingeckoRes, kimchiData] = await Promise.all([
          fetch(
            `/api/coingecko-proxy?path=${encodeURIComponent(
              `/simple/price?ids=${TRACKED_COINS.join(",")}&vs_currencies=usd&include_24hr_change=true`
            )}`
          ).catch(() => null),
          calculateKimchiPremium().catch(() => null),
        ]);

        if (cancelled) return;

        if (kimchiData) {
          setKimchi(kimchiData);
        }

        if (coingeckoRes && coingeckoRes.ok) {
          const data = await coingeckoRes.json();
          const parsed: Coin[] = TRACKED_COINS.filter((id) => data[id]).map((id) => ({
            id,
            symbol: SYMBOL_MAP[id] ?? id.toUpperCase(),
            price: data[id].usd,
            change24h: data[id].usd_24h_change ?? 0,
          }));
          setCoins(parsed);
        }
      } catch {
        // Silently preserve last known values
      }
    }

    load();
    const interval = setInterval(load, 25000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (coins.length === 0 && !kimchi) return null;

  return (
    <div
      style={{
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
        overflow: "hidden",
        position: "relative",
        height: 38,
        display: "flex",
        alignItems: "center",
        transition: "background 0.3s ease",
      }}
    >
      {/* Upbit Kimchi Premium Live Badge */}
      {kimchi && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 14px",
            borderRight: "1px solid var(--border)",
            background: "oklch(0.6724 0.1308 38.7559 / 0.12)",
            height: "100%",
            flexShrink: 0,
            zIndex: 2,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)" }}>🇰🇷 UPBIT</span>
          <span style={{ fontSize: 11.5, color: "var(--foreground)", fontWeight: 700 }}>
            USD/KRW {formatKrw(kimchi.usdKrwRate)}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: 4,
              background: kimchi.ethKimchiPremiumPct >= 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: kimchi.ethKimchiPremiumPct >= 0 ? "#10B981" : "#EF4444",
            }}
          >
            김프 {kimchi.ethKimchiPremiumPct >= 0 ? "+" : ""}{kimchi.ethKimchiPremiumPct.toFixed(2)}%
          </span>
        </div>
      )}

      {/* Marquee Ticker */}
      <div className="flowfi-ticker-track" style={{ display: "flex", gap: 28, whiteSpace: "nowrap", paddingLeft: 20 }}>
        {[...coins, ...coins].map((c, i) => (
          <div key={`${c.id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
            <span style={{ fontWeight: 700, color: "var(--foreground)" }}>{c.symbol}</span>
            <span className="prism-mono" style={{ color: "var(--muted-foreground)" }}>
              ${c.price >= 1 ? c.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : c.price.toFixed(4)}
            </span>
            {kimchi && (
              <span className="prism-mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                ({formatKrw(c.price * kimchi.usdKrwRate)})
              </span>
            )}
            <span style={{ color: c.change24h >= 0 ? "#10B981" : "#EF4444", fontWeight: 600 }}>
              {c.change24h >= 0 ? "▲" : "▼"} {Math.abs(c.change24h).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes flowfi-ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .flowfi-ticker-track {
          animation: flowfi-ticker-scroll 35s linear infinite;
        }
        .flowfi-ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
