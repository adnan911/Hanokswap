import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { mainnet } from "../chains";

export default function LiveBlock() {
  const [block, setBlock] = useState<bigint | null>(null);

  useEffect(() => {
    let alive = true;
    const client = createPublicClient({ chain: mainnet, transport: http() });
    const tick = () => {
      if (document.hidden) return;
      client.getBlockNumber().then((b) => { if (alive) setBlock(b); }).catch(() => {});
    };
    tick();
    const id = setInterval(tick, 6000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (block === null) return null;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--muted-foreground)" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--primary)", boxShadow: "0 0 6px var(--primary)" }} />
      <span style={{ fontWeight: 600 }}>Multi-Chain Live</span>
      <span style={{ color: "var(--border)" }}>·</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums", color: "var(--foreground)" }}>Block #{block.toLocaleString("en-US")}</span>
    </div>
  );
}
