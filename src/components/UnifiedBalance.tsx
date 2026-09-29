import { useState, useEffect } from "react";
import { createPublicClient, http, erc20Abi, formatUnits } from "viem";
import { sepolia, baseSepolia, arbitrumSepolia } from "viem/chains";
import { arcTestnet } from "../chains";
import { CHAINS as BRIDGE_CHAINS } from "./BridgeForm";

interface Props {
  address: string;
}

interface ChainBalance {
  name: string;
  balance: string | null;
  color: string;
  explorerTx: string;
}

const CHAINS = [
  { name: "Arc Testnet", chain: arcTestnet, usdc: BRIDGE_CHAINS["Arc Testnet"].usdc, color: "#E2E0C8", explorer: "https://testnet.arcscan.app/address/" },
  { name: "Ethereum Sepolia", chain: sepolia, usdc: BRIDGE_CHAINS["Ethereum Sepolia"].usdc, color: "#A6B49E", explorer: "https://sepolia.etherscan.io/address/" },
  { name: "Base Sepolia", chain: baseSepolia, usdc: BRIDGE_CHAINS["Base Sepolia"].usdc, color: "#818C78", explorer: "https://sepolia.basescan.org/address/" },
  { name: "Arbitrum Sepolia", chain: arbitrumSepolia, usdc: BRIDGE_CHAINS["Arbitrum Sepolia"].usdc, color: "#4E635E", explorer: "https://sepolia.arbiscan.io/address/" },
];

export default function UnifiedBalance({ address }: Props) {
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      const results: ChainBalance[] = [];
      for (const c of CHAINS) {
        try {
          const client = createPublicClient({ chain: c.chain, transport: http() });
          const raw = await client.readContract({ address: c.usdc, abi: erc20Abi, functionName: "balanceOf", args: [address as `0x${string}`] });
          results.push({ name: c.name, balance: Number(formatUnits(raw, 6)).toFixed(2), color: c.color, explorerTx: c.explorer + address });
        } catch {
          results.push({ name: c.name, balance: "—", color: c.color, explorerTx: c.explorer + address });
        }
        await new Promise(r => setTimeout(r, 300));
      }
      setBalances(results);
      setLoading(false);
    }
    if (address) loadAll();
  }, [address]);

  const total = balances.reduce((sum, b) => sum + (b.balance && b.balance !== "—" ? Number(b.balance) : 0), 0);

  return (
    <div style={{ background: "rgba(20, 28, 25, 0.72)", border: "1px solid rgba(226, 224, 200, 0.12)", backdropFilter: "blur(16px)", borderRadius: 20, padding: "1.25rem", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#818C78", fontWeight: 700, letterSpacing: "1px" }}>UNIFIED USDC BALANCE</div>
        {!loading && <div className="prism-mono" style={{ fontSize: 13, color: "#E2E0C8", fontWeight: 700 }}>${total.toFixed(2)} total</div>}
      </div>

      {loading && <div style={{ fontSize: 12, color: "#818C78" }}>Checking balances across chains...</div>}

      {!loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {balances.map((b) => (
            <a key={b.name} href={b.explorerTx} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.8rem", borderRadius: 12, background: "rgba(226, 224, 200, 0.04)", border: "1px solid rgba(226, 224, 200, 0.08)", textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.color }} />
                <span style={{ fontSize: 12, color: "#E2E0C8" }}>{b.name}</span>
              </div>
              <span className="prism-mono" style={{ fontSize: 13, color: "#A6B49E", fontWeight: 600 }}>{b.balance === null ? "..." : `${b.balance} USDC`}</span>
            </a>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 11, color: "#818C78" }}>
        Bridge any of these to Arc using CCTP from the Bridge tab.
      </div>
    </div>
  );
}
