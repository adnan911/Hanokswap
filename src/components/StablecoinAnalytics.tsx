import { useState, useEffect } from "react";
import { useIsMobile } from "../useIsMobile";
import { Repeat, Zap } from "lucide-react";
import { USDC_LOGO, EURC_LOGO } from "./tokenLogos";
import { useLanguage } from "../LanguageContext";

interface StableData {
  id: string;
  name: string;
  symbol: string;
  price: number;
  marketCap: number;
  vol24h: number;
  change24h: number;
  logo: string;
}

export default function StablecoinAnalytics({ onNavigate }: { onNavigate?: (tab: "mainnetswap" | "mainnetbridge") => void }) {
  const isMobile = useIsMobile();
  const { t, language } = useLanguage();
  const [stables, setStables] = useState<StableData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/coingecko-proxy?path=" + encodeURIComponent("/coins/markets?vs_currency=usd&ids=usd-coin,tether,euro-coin,dai&order=market_cap_desc&sparkline=false&price_change_percentage=24h"));
        const data = await res.json();
        if (Array.isArray(data)) {
          setStables(data.map((item: any) => ({
            id: item.id,
            name: item.name,
            symbol: item.symbol.toUpperCase(),
            price: item.current_price,
            marketCap: item.market_cap,
            vol24h: item.total_volume,
            change24h: item.price_change_percentage_24h,
            logo: item.image || (item.symbol.toUpperCase() === "EURC" ? EURC_LOGO : USDC_LOGO),
          })));
        }
      } catch {
        // Fallback static metrics
        setStables([
          { id: "usd-coin", name: "USD Coin", symbol: "USDC", price: 1.0, marketCap: 34500000000, vol24h: 4200000000, change24h: 0.01, logo: USDC_LOGO },
          { id: "tether", name: "Tether", symbol: "USDT", price: 1.0, marketCap: 118000000000, vol24h: 28000000000, change24h: -0.02, logo: "https://cryptologos.cc/logos/tether-usdt-logo.svg?v=035" },
          { id: "euro-coin", name: "Euro Coin", symbol: "EURC", price: 1.08, marketCap: 95000000, vol24h: 12000000, change24h: 0.05, logo: EURC_LOGO },
          { id: "dai", name: "Dai", symbol: "DAI", price: 1.0, marketCap: 5300000000, vol24h: 210000000, change24h: 0.0, logo: "https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.svg?v=035" },
        ]);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const totalMarketCap = stables.reduce((acc, s) => acc + (s.marketCap || 0), 0);

  const card = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: "1.5rem", boxShadow: "0 18px 40px rgba(0,0,0,0.3)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Top Banner KPI */}
      <div style={{ background: "linear-gradient(135deg, var(--card) 0%, var(--muted) 100%)", border: "1px solid var(--border)", borderRadius: 20, padding: "1.75rem", boxShadow: "0 18px 40px rgba(0,0,0,0.3)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-50%", right: "-10%", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, oklch(0.6724 0.1308 38.7559 / 0.15) 0%, transparent 70%)" }} />
        <div style={{ fontSize: 11.5, color: "var(--primary)", fontWeight: 800, letterSpacing: "1.5px", marginBottom: 6, textTransform: "uppercase" }}>{t.globalStablecoinLiquidity}</div>
        <div className="prism-mono" style={{ fontSize: isMobile ? 32 : 42, fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
          {loading ? "..." : `$${(totalMarketCap / 1e9).toFixed(2)}B`}
        </div>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6, margin: 0 }}>
          {language === "ko" ? "통합된 탈중앙화 프로토콜 전반의 총 유동성 및 24시간 거래량입니다." : "Aggregate liquidity and 24h trading volume across aggregated decentralized protocols."}
        </p>
      </div>

      {/* Grid of details */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1.25rem" }}>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--foreground)" }}>{t.stablecoinDominance}</div>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{t.topAssets}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {stables.map((s) => {
              const pct = totalMarketCap > 0 ? (s.marketCap / totalMarketCap) * 100 : 0;
              return (
                <div key={s.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, fontSize: 13 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--foreground)", fontWeight: 700 }}>
                      <img src={s.logo} alt={s.symbol} width={20} height={20} style={{ width: 20, height: 20, borderRadius: "50%" }} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                      {s.name} ({s.symbol})
                    </span>
                    <span className="prism-mono" style={{ fontWeight: 700, color: "var(--foreground)" }}>{pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "var(--primary)", borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--foreground)" }}>{t.livePegTracking}</div>
            <span style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700 }}>{t.pegged}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {stables.map((s) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 12, background: "var(--muted)", border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{s.symbol}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 2 }}>${(s.vol24h / 1e6).toFixed(1)}M {language === "ko" ? "24시간 볼륨" : "24h Vol"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="prism-mono" style={{ fontSize: 14, fontWeight: 800, color: "var(--foreground)" }}>${s.price.toFixed(4)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: s.change24h >= 0 ? "var(--primary)" : "#EF4444" }}>
                    {s.change24h >= 0 ? "+" : ""}{s.change24h?.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Footer banner */}
      <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)", marginBottom: 4 }}>{language === "ko" ? "하옥스왑에서 최적의 유동성으로 거래하세요" : "Trade with optimal liquidity on HanokSwap"}</div>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{language === "ko" ? "모든 주요 EVM 체인에서 집약된 DEX 라우팅을 제공합니다." : "Route your swaps through aggregated DEXes across all major chains."}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {onNavigate && (
            <>
              <button onClick={() => onNavigate("mainnetswap")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 12, border: "none", background: "var(--primary)", color: "#FFFFFF", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 14px oklch(0.6724 0.1308 38.7559 / 0.35)" }}>
                <Repeat size={14} /> {t.swap}
              </button>
              <button onClick={() => onNavigate("mainnetbridge")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                <Zap size={14} /> {t.bridge}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
