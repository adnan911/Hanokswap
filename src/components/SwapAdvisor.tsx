import { useState, useEffect, useCallback, type ReactNode } from "react";
import { createPublicClient, http, formatUnits } from "viem";
import { arcTestnet } from "../chains";
import { POOL_USDC_EURC as POOL_ADDRESS } from "../contracts";
import { Star, Check, AlertTriangle, X, ChevronUp, ChevronDown } from "lucide-react";

const POOL_ABI = [
  { type: "function", name: "getReserves", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }, { name: "", type: "uint256" }] },
] as const;

interface Props {
  tokenIn: "USDC" | "EURC";
  tokenOut: "USDC" | "EURC";
  amountIn: string;
  amountOut: string;
}

interface Factor {
  label: string;
  value: string;
  status: "good" | "warn" | "bad";
}

interface Advisory {
  score: number;
  stars: number;
  label: string;
  poolImpact: number;
  poolLiquidityOut: string;
  recommendation: string;
  splitSuggestion: number | null;
  factors: Factor[];
}

function scoreFromImpact(impact: number): { score: number; stars: number; label: string } {
  if (impact < 0.01) return { score: 95, stars: 5, label: "Good Time" };
  if (impact < 0.05) return { score: 80, stars: 4, label: "Good Time" };
  if (impact < 0.15) return { score: 60, stars: 3, label: "Caution" };
  if (impact < 0.3) return { score: 35, stars: 2, label: "Wait" };
  return { score: 15, stars: 1, label: "High Risk" };
}

function buildFactors(impact: number, poolOut: number, out: number, splitSuggestion: number | null): Factor[] {
  const factors: Factor[] = [];

  factors.push({
    label: "Pool consumption",
    value: `${(impact * 100).toFixed(2)}% of ${poolOut.toFixed(2)} available`,
    status: impact < 0.05 ? "good" : impact < 0.15 ? "warn" : "bad",
  });

  factors.push({
    label: "Remaining liquidity after swap",
    value: `${(poolOut - out).toFixed(2)}`,
    status: (poolOut - out) / poolOut > 0.7 ? "good" : (poolOut - out) / poolOut > 0.4 ? "warn" : "bad",
  });

  if (splitSuggestion) {
    factors.push({
      label: "Splitting reduces impact per trade to",
      value: `~${((impact / splitSuggestion) * 100).toFixed(2)}% each`,
      status: "warn",
    });
  } else {
    factors.push({
      label: "Single-transaction impact",
      value: "Low enough to execute as one swap",
      status: "good",
    });
  }

  return factors;
}

export default function SwapAdvisor({ tokenIn, tokenOut, amountIn, amountOut }: Props) {
  const [advisory, setAdvisory] = useState<Advisory | null>(null);
  const [loading, setLoading] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  const analyze = useCallback(async () => {
    if (!amountIn || isNaN(Number(amountIn)) || Number(amountIn) <= 0 || !amountOut || Number(amountOut) <= 0) {
      setAdvisory(null);
      return;
    }
    setLoading(true);
    try {
      const client = createPublicClient({ chain: arcTestnet, transport: http() });
      const [usdcBal, eurcBal] = await client.readContract({ address: POOL_ADDRESS, abi: POOL_ABI, functionName: "getReserves" });
      const poolOut = tokenOut === "USDC" ? Number(formatUnits(usdcBal, 6)) : Number(formatUnits(eurcBal, 6));
      const out = Number(amountOut);
      const impact = poolOut > 0 ? out / poolOut : 1;

      const { score, stars, label } = scoreFromImpact(impact);
      const splitSuggestion = impact >= 0.15 ? Math.ceil(impact / 0.04) : null;
      const factors = buildFactors(impact, poolOut, out, splitSuggestion);

      let recommendation = "";
      try {
        const response = await fetch("/api/claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 150,
            system: "You are a swap risk advisor for a DeFi app. You are given real on-chain pool data. Write a 2-3 sentence recommendation in English, grounded ONLY in the numbers given. Never invent data not provided. Be direct and concrete. Explain briefly WHY you're giving this recommendation, referencing the specific pool impact percentage.",
            messages: [
              {
                role: "user",
                content: `Swap: ${amountIn} ${tokenIn} -> ${amountOut} ${tokenOut}. Pool liquidity available for ${tokenOut}: ${poolOut.toFixed(4)}. This swap would consume ${(impact * 100).toFixed(2)}% of that pool's liquidity. Remaining liquidity after swap: ${(poolOut - out).toFixed(4)}. Give your recommendation and briefly explain why.`,
              },
            ],
          }),
        });
        const data = await response.json();
        recommendation = data.content?.[0]?.text ?? "";
      } catch {
        recommendation = impact < 0.05
          ? "Pool liquidity is sufficient for this swap size relative to available reserves."
          : "This swap would consume a significant portion of available pool liquidity. Consider a smaller amount.";
      }

      setAdvisory({
        score, stars, label,
        poolImpact: impact * 100,
        poolLiquidityOut: poolOut.toFixed(2),
        recommendation,
        splitSuggestion,
        factors,
      });
    } catch (e) {
      console.log("SwapAdvisor error:", e);
      setAdvisory(null);
    } finally {
      setLoading(false);
    }
  }, [tokenIn, tokenOut, amountIn, amountOut]);

  useEffect(() => {
    const t = setTimeout(analyze, 500);
    return () => clearTimeout(t);
  }, [analyze]);

  if (!amountIn || Number(amountIn) <= 0) return null;

  const statusIcon: Record<string, ReactNode> = {
    good: <Check size={10} color="#A6B49E" />,
    warn: <AlertTriangle size={10} color="#E2E0C8" />,
    bad: <X size={10} color="#EF4444" />,
  };

  return (
    <div style={{ background: "rgba(20, 28, 25, 0.72)", border: "1px solid rgba(226, 224, 200, 0.12)", borderRadius: 14, padding: "1rem", display: "flex", flexDirection: "column", gap: 10, backdropFilter: "blur(20px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#E2E0C8", fontWeight: 700, letterSpacing: "0.5px" }}>SWAP ADVISOR</span>
        {loading && <span style={{ fontSize: 11, color: "#818C78" }}>Analyzing...</span>}
      </div>

      {advisory && !loading && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  size={14}
                  fill={i <= advisory.stars ? "#A6B49E" : "transparent"}
                  color={i <= advisory.stars ? "#A6B49E" : "rgba(226, 224, 200, 0.2)"}
                />
              ))}
            </div>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
              color: "#E2E0C8",
              background: advisory.stars >= 4 ? "rgba(166, 180, 158, 0.2)" : advisory.stars >= 3 ? "rgba(129, 140, 120, 0.2)" : "rgba(239,68,68,0.18)",
              border: "1px solid rgba(226, 224, 200, 0.15)"
            }}>
              {advisory.label}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#818C78" }}>Pool Impact</span>
              <span style={{ color: advisory.poolImpact > 15 ? "#FCA5A5" : "#E2E0C8", fontWeight: 600 }}>{advisory.poolImpact.toFixed(2)}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#818C78" }}>Pool Liquidity</span>
              <span style={{ color: "#E2E0C8", fontWeight: 600 }}>{advisory.poolLiquidityOut} {tokenOut}</span>
            </div>
          </div>

          <div style={{ background: "rgba(16, 23, 20, 0.6)", border: "1px solid rgba(226, 224, 200, 0.08)", borderRadius: 10, padding: "0.65rem 0.8rem" }}>
            <p style={{ fontSize: 12, color: "#A6B49E", lineHeight: 1.5, margin: 0 }}>{advisory.recommendation}</p>
          </div>

          <button onClick={() => setShowWhy(!showWhy)}
            style={{ background: "none", border: "none", color: "#E2E0C8", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, textAlign: "left", display: "inline-flex", alignItems: "center", gap: 4 }}>
            {showWhy ? <>Hide breakdown <ChevronUp size={12} /></> : <>Why this score? <ChevronDown size={12} /></>}
          </button>

          {showWhy && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "rgba(16, 23, 20, 0.6)", border: "1px solid rgba(226, 224, 200, 0.08)", borderRadius: 10, padding: "0.65rem 0.8rem" }}>
              {advisory.factors.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                  <span style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(166, 180, 158, 0.15)", color: "#E2E0C8", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {statusIcon[f.status]}
                  </span>
                  <span style={{ color: "#A6B49E", flex: 1 }}>{f.label}</span>
                  <span style={{ color: "#E2E0C8", fontWeight: 600 }}>{f.value}</span>
                </div>
              ))}
            </div>
          )}

          {advisory.splitSuggestion && (
            <div style={{ background: "rgba(129, 140, 120, 0.15)", border: "1px solid rgba(226, 224, 200, 0.15)", borderRadius: 10, padding: "0.65rem 0.8rem" }}>
              <p style={{ fontSize: 12, color: "#E2E0C8", margin: 0 }}>
                Consider splitting into {advisory.splitSuggestion} smaller swaps to reduce pool impact per transaction.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
