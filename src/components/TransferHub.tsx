import { useState } from "react";
import type { EIP1193Provider } from "viem";
import BridgeForm from "./BridgeForm";
import GatewayPanel from "./GatewayPanel";
import { useIsMobile } from "../useIsMobile";

interface Props {
  provider: EIP1193Provider;
  address: string;
  walletName: string;
  onNavigate?: (tab: "swap") => void;
}

export default function TransferHub({ provider, address, walletName, onNavigate }: Props) {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<"bridge" | "gateway">("bridge");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", gap: 8, maxWidth: isMobile ? undefined : 440, background: "rgba(226,224,200,0.04)", border: "1px solid rgba(226,224,200,0.08)", borderRadius: 16, padding: 4 }}>
        <button onClick={() => setMode("bridge")}
          style={{ flex: 1, padding: "0.75rem 1rem", borderRadius: 12, border: mode === "bridge" ? "1px solid rgba(166, 180, 158, 0.35)" : "1px solid transparent", background: mode === "bridge" ? "rgba(166, 180, 158, 0.18)" : "transparent", color: mode === "bridge" ? "#E2E0C8" : "#818C78", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
          Prism CCTP Bridge
          <div style={{ fontSize: 10.5, fontWeight: 500, color: mode === "bridge" ? "#A6B49E" : "#818C78", marginTop: 2 }}>Circle burn/mint across 15+ networks</div>
        </button>
        <button onClick={() => setMode("gateway")}
          style={{ flex: 1, padding: "0.75rem 1rem", borderRadius: 12, border: mode === "gateway" ? "1px solid rgba(166, 180, 158, 0.35)" : "1px solid transparent", background: mode === "gateway" ? "rgba(166, 180, 158, 0.18)" : "transparent", color: mode === "gateway" ? "#E2E0C8" : "#818C78", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
          Circle Gateway
          <div style={{ fontSize: 10.5, fontWeight: 500, color: mode === "gateway" ? "#A6B49E" : "#818C78", marginTop: 2 }}>Single deposit, &lt;500ms settlement</div>
        </button>
      </div>

      {mode === "bridge"
        ? <BridgeForm provider={provider} address={address} walletName={walletName} onNavigate={onNavigate} />
        : <GatewayPanel provider={provider} address={address} />}
    </div>
  );
}
