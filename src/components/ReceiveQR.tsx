import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { showToast } from "../toast";

interface Props {
  address: string;
}

export default function ReceiveQR({ address }: Props) {
  const [qr, setQr] = useState<{ address: string; url: string | null } | null>(null);
  const qrDataUrl = qr?.address === address ? qr.url : null;
  const failed = qr?.address === address && qr.url === null;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(address, {
      width: 220,
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" },
    })
      .then((url) => { if (!cancelled) setQr({ address, url }); })
      .catch(() => { if (!cancelled) setQr({ address, url: null }); });
    return () => { cancelled = true; };
  }, [address]);

  async function copyAddress() {
    try {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("Could not copy address. Please copy it manually.", "error");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: "100%", maxWidth: 360, margin: "0 auto" }}>
      <div style={{ background: "rgba(20, 28, 25, 0.72)", border: "1px solid rgba(226, 224, 200, 0.12)", borderRadius: 20, padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: "100%", boxShadow: "0 18px 40px rgba(0, 0, 0, 0.35)", backdropFilter: "blur(20px)" }}>
        <div style={{ fontSize: 13, color: "#E2E0C8", fontWeight: 600, textAlign: "center" }}>
          Scan to send USDC or EURC to this wallet
        </div>

        {qrDataUrl ? (
          <div style={{ background: "rgba(255, 255, 255, 0.95)", border: "1px solid rgba(226, 224, 200, 0.25)", borderRadius: 16, padding: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
            <img src={qrDataUrl} alt="Wallet address QR code" width={220} height={220} style={{ display: "block", maxWidth: "100%", height: "auto" }} />
          </div>
        ) : (
          <div style={{ width: 220, height: 220, borderRadius: 16, background: "rgba(16, 23, 20, 0.6)", border: "1px solid rgba(226, 224, 200, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#818C78", fontSize: 12 }}>
            {failed ? "Could not generate QR code. Copy the address below." : "Generating QR code..."}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
          <div style={{ fontSize: 11, color: "#818C78", fontWeight: 600, letterSpacing: "1px" }}>YOUR ADDRESS</div>
          <div className="flowfi-mono" style={{ fontSize: 12.5, color: "#E2E0C8", wordBreak: "break-all", textAlign: "center" }}>
            {address}
          </div>
        </div>

        <button onClick={copyAddress}
          style={{ width: "100%", padding: "0.75rem", borderRadius: 12, border: "none", background: copied ? "rgba(166, 180, 158, 0.25)" : "linear-gradient(135deg, #4E635E 0%, #818C78 100%)", color: "#E2E0C8", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 10px 25px rgba(0,0,0,0.35)" }}>
          {copied ? "Copied!" : "Copy Address"}
        </button>
      </div>

      <div style={{ fontSize: 11, color: "#818C78", textAlign: "center" }}>
        This address works on Arc Testnet only.
      </div>
    </div>
  );
}
