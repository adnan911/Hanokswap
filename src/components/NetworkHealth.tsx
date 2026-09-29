import { useState, useEffect } from "react";
import { createPublicClient, http, formatUnits } from "viem";
import { sepolia, baseSepolia, arbitrumSepolia } from "viem/chains";
import { arcTestnet } from "../chains";
import { ExternalLink } from "lucide-react";

interface ChainStatus {
  name: string;
  gasPrice: string | null;
  status: "operational" | "degraded" | "checking";
  color: string;
}

const CHAINS = [
  { name: "Arc Testnet", chain: arcTestnet, color: "#7c3aed" },
  { name: "Ethereum Sepolia", chain: sepolia, color: "#627eea" },
  { name: "Base Sepolia", chain: baseSepolia, color: "#0052ff" },
  { name: "Arbitrum Sepolia", chain: arbitrumSepolia, color: "#28a0f0" },
];

export default function NetworkHealth() {
  const [statuses, setStatuses] = useState<ChainStatus[]>(
    CHAINS.map((c) => ({ name: c.name, gasPrice: null, status: "checking", color: c.color }))
  );

  useEffect(() => {
    let cancelled = false;

    async function checkChain(index: number) {
      const { chain } = CHAINS[index];
      try {
        const client = createPublicClient({ chain, transport: http() });
        const start = Date.now();
        const gasPrice = await client.getGasPrice();
        const latency = Date.now() - start;
        if (cancelled) return;
        setStatuses((prev) => prev.map((s, i) => i === index ? {
          ...s,
          gasPrice: Number(formatUnits(gasPrice, 9)).toFixed(2),
          status: latency < 3000 ? "operational" : "degraded",
        } : s));
      } catch {
        if (cancelled) return;
        setStatuses((prev) => prev.map((s, i) => i === index ? { ...s, status: "degraded", gasPrice: null } : s));
      }
    }

    CHAINS.forEach((_, i) => checkChain(i));
    const interval = setInterval(() => CHAINS.forEach((_, i) => checkChain(i)), 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div style={{ background: "rgba(20, 28, 25, 0.72)", backdropFilter: "blur(20px)", border: "1px solid rgba(226, 224, 200, 0.12)", borderRadius: 16, padding: "1.1rem", boxShadow: "0 18px 40px rgba(0, 0, 0, 0.45)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#818C78", fontWeight: 700, letterSpacing: "1px" }}>NETWORK HEALTH</div>
        <a href="https://status.circle.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#A6B49E", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
          Circle Status <ExternalLink size={10} />
        </a>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {statuses.map((s) => (
          <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#A6B49E" }} />
              <span style={{ fontSize: 12, color: "#E2E0C8" }}>{s.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {s.gasPrice && <span className="flowfi-mono" style={{ fontSize: 11, color: "#818C78" }}>{s.gasPrice} gwei</span>}
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                color: s.status === "operational" ? "#A6B49E" : s.status === "degraded" ? "#FCA5A5" : "#818C78",
                background: s.status === "operational" ? "rgba(166, 180, 158, 0.15)" : s.status === "degraded" ? "rgba(239, 68, 68, 0.15)" : "rgba(78, 99, 94, 0.2)",
                border: "1px solid rgba(226, 224, 200, 0.08)",
              }}>
                {s.status === "operational" ? "Healthy" : s.status === "degraded" ? "Slow" : "..."}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
