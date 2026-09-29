import { useDialog } from "../useDialog";
import type { EIP1193Provider } from "viem";
import { X, ShieldCheck } from "lucide-react";
import WalletConnect from "./WalletConnect";
import { useLanguage } from "../LanguageContext";

interface Props {
  onClose: () => void;
  onConnected: (provider: EIP1193Provider, address: string, walletName: string) => void;
  onCircleConnected?: (info: any) => void;
}

export default function ConnectModal({ onClose, onConnected }: Props) {
  const dialogRef = useDialog(onClose);
  const { t } = useLanguage();

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(8, 12, 11, 0.85)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Connect to HanokSwap" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "2rem", boxShadow: "0 24px 60px rgba(0,0,0,0.85), 0 0 30px oklch(0.6724 0.1308 38.7559 / 0.15)", maxHeight: "90vh", overflowY: "auto", color: "var(--foreground)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div className="prism-display" style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)" }}>{t.modalConnectTitle}</div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>{t.modalConnectDesc}</div>
          </div>
          <button aria-label="Close connection dialog" onClick={onClose} style={{ background: "var(--muted)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "var(--muted-foreground)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <WalletConnect onConnected={onConnected} />
        </div>

        <div style={{ marginTop: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 14, color: "var(--muted-foreground)", fontSize: 12 }}>
          <ShieldCheck size={14} color="var(--primary)" />
          <span>{t.modalNonCustodialNotice}</span>
        </div>
      </div>
    </div>
  );
}
