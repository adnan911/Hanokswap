import React, { useState } from "react";
import { type Address } from "viem";
import {
  ShieldCheck,
  Award,
  CheckCircle2,
  Copy,
  Check,
  X,
  Zap,
  Sparkles,
  Info,
} from "lucide-react";
import { useDojang } from "../hooks/useDojang";
import { formatUpIdDisplay } from "../lib/dojang";
import { GIWA_DOJANG_SCROLL } from "../contracts";

interface DojangIdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: Address | undefined;
}

export const DojangIdentityModal: React.FC<DojangIdentityModalProps> = ({
  isOpen,
  onClose,
  address,
}) => {
  const { profile, claimUpId, mintTestnetAttestation } = useDojang(address);
  const [nameInput, setNameInput] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [minting, setMinting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedContract, setCopiedContract] = useState(false);
  const [activeInfo, setActiveInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let cleaned = nameInput.trim().toLowerCase();
    while (cleaned.endsWith(".up.id")) {
      cleaned = cleaned.slice(0, -6);
    }
    if (!cleaned) return;

    setClaiming(true);
    try {
      const res = await claimUpId(cleaned);
      if (!res.success) {
        setError(res.error || "Failed to register up.id");
      } else {
        setNameInput("");
      }
    } catch (err: any) {
      setError(err?.message || "Registration failed");
    } finally {
      setClaiming(false);
    }
  };

  const handleMint = async (tier: "UPBIT_KYC" | "DUNAMU_VIP") => {
    setError(null);
    setMinting(tier);
    try {
      await mintTestnetAttestation(tier);
    } catch (err: any) {
      setError(err?.message || "Failed to issue attestation");
    } finally {
      setMinting(null);
    }
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyContract = () => {
    navigator.clipboard.writeText(GIWA_DOJANG_SCROLL);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        backgroundColor: "rgba(8, 11, 17, 0.82)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="uniswap-card"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "460px",
          padding: "22px 24px",
          borderRadius: "24px",
          color: "var(--foreground, #ffffff)",
          fontFamily: "var(--font-sans, inherit)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #e11d48 0%, #ea580c 50%, var(--primary, #ff5a36) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 900,
                fontSize: "17px",
                flexShrink: 0,
              }}
            >
              印
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, letterSpacing: "-0.01em" }}>
                  Dojang & up.id
                </h2>
                <span
                  style={{
                    fontSize: "10.5px",
                    fontWeight: 800,
                    padding: "2px 7px",
                    borderRadius: "999px",
                    background: "var(--accent)",
                    color: "var(--primary)",
                  }}
                >
                  EAS
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "var(--secondary)",
              border: "1px solid var(--border)",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              color: "var(--muted-foreground)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 12px",
              borderRadius: "12px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {/* Info Popover Modal / Bubble */}
        {activeInfo && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 14px",
              borderRadius: "12px",
              background: "var(--secondary)",
              border: "1px solid var(--primary)",
              color: "var(--foreground)",
              fontSize: "12px",
              lineHeight: 1.4,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span>{activeInfo}</span>
            <button
              onClick={() => setActiveInfo(null)}
              style={{ background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer" }}
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Identity Status Card */}
        <div
          style={{
            marginTop: "16px",
            padding: "14px 16px",
            borderRadius: "16px",
            background: "var(--input)",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Row 1: Wallet & Handle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase" }}>
                Identity Handle
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                {profile.upIdName ? (
                  <>
                    <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--primary)" }}>
                      {formatUpIdDisplay(profile.upIdName)}
                    </span>
                    <CheckCircle2 size={15} style={{ color: "#22c55e" }} />
                  </>
                ) : (
                  <span style={{ fontSize: "13px", color: "var(--muted-foreground)" }}>
                    No up.id handle
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={copyAddress}
              disabled={!address}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "var(--secondary)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: address ? "pointer" : "default",
                padding: "4px 9px",
                borderRadius: "8px",
              }}
            >
              {copied ? <Check size={12} style={{ color: "#22c55e" }} /> : <Copy size={12} />}
              <span>{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Disconnected"}</span>
            </button>
          </div>

          {/* Row 2: Fee Discount */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: "12px", color: "var(--muted-foreground)", fontWeight: 600 }}>
              DEX Fee Discount
            </span>
            <div>
              {profile.feeDiscountPercent > 0 ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11.5px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "6px",
                    background: profile.isVIPTrader ? "rgba(245, 158, 11, 0.15)" : "rgba(34, 197, 94, 0.15)",
                    border: profile.isVIPTrader ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(34, 197, 94, 0.4)",
                    color: profile.isVIPTrader ? "#f59e0b" : "#22c55e",
                  }}
                >
                  <Zap size={11} /> -{profile.feeDiscountPercent}% Fee
                </span>
              ) : (
                <span style={{ fontSize: "12px", color: "var(--muted-foreground)", fontWeight: 600 }}>
                  0% (Standard)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Claim Input Form */}
        <div style={{ marginTop: "16px" }}>
          <form onSubmit={handleClaim} style={{ display: "flex", gap: "8px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value.replace(/[^a-z0-9-_]/gi, ""))}
                placeholder="satoshi or your_name"
                disabled={claiming || !address}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "var(--input)",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "10px 60px 10px 12px",
                  color: "var(--foreground)",
                  fontSize: "13.5px",
                  outline: "none",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  color: "var(--muted-foreground)",
                  pointerEvents: "none",
                }}
              >
                .up.id
              </span>
            </div>

            <button
              type="submit"
              disabled={claiming || !address || !nameInput.trim()}
              className="uniswap-btn-primary"
              style={{
                width: "auto",
                padding: "0 18px",
                fontSize: "13px",
                fontWeight: 800,
                borderRadius: "14px",
                cursor: (claiming || !address || !nameInput.trim()) ? "not-allowed" : "pointer",
                opacity: (claiming || !address || !nameInput.trim()) ? 0.5 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Sparkles size={13} />
              <span>{claiming ? "Claiming..." : "Claim"}</span>
            </button>
          </form>
        </div>

        {/* Attestations / Verification Tiers */}
        <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted-foreground)", textTransform: "uppercase" }}>
              Attestation Badges
            </span>
          </div>

          {/* Upbit KYC Item */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "14px",
              background: profile.isKYCVerified ? "rgba(59, 130, 246, 0.08)" : "var(--input)",
              border: profile.isKYCVerified ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ShieldCheck size={16} color={profile.isKYCVerified ? "#3b82f6" : "var(--muted-foreground)"} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--foreground)" }}>
                    Upbit KYC Level 2
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveInfo("Upbit KYC attestation grants a 20% dynamic swap fee discount & access to compliance pools.")}
                    style={{ background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}
                    title="Details"
                  >
                    <Info size={12} />
                  </button>
                </div>
              </div>
            </div>

            {profile.isKYCVerified ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "12px", color: "#3b82f6", fontWeight: 800 }}>
                <Check size={13} /> Active
              </span>
            ) : (
              <button
                onClick={() => handleMint("UPBIT_KYC")}
                disabled={minting !== null || !address}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--secondary)",
                  color: "var(--foreground)",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  cursor: minting !== null || !address ? "not-allowed" : "pointer",
                }}
              >
                {minting === "UPBIT_KYC" ? "Issuing..." : "Verify KYC"}
              </button>
            )}
          </div>

          {/* Dunamu VIP Item */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "14px",
              background: profile.isVIPTrader ? "rgba(245, 158, 11, 0.08)" : "var(--input)",
              border: profile.isVIPTrader ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Award size={16} color={profile.isVIPTrader ? "#f59e0b" : "var(--muted-foreground)"} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--foreground)" }}>
                    Dunamu VIP Tier
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveInfo("Dunamu VIP tier unlocks 50% max swap fee rebate and priority Flashblocks execution.")}
                    style={{ background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}
                    title="Details"
                  >
                    <Info size={12} />
                  </button>
                </div>
              </div>
            </div>

            {profile.isVIPTrader ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "12px", color: "#f59e0b", fontWeight: 800 }}>
                <Check size={13} /> Active
              </span>
            ) : (
              <button
                onClick={() => handleMint("DUNAMU_VIP")}
                disabled={minting !== null || !address}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--secondary)",
                  color: "var(--foreground)",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  cursor: minting !== null || !address ? "not-allowed" : "pointer",
                }}
              >
                {minting === "DUNAMU_VIP" ? "Issuing..." : "Upgrade VIP"}
              </button>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--muted-foreground)" }}>
          <span>GIWA Sepolia (91342)</span>
          <button
            onClick={copyContract}
            style={{ background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: 4 }}
          >
            <span>Dojang: {GIWA_DOJANG_SCROLL.slice(0, 6)}...{GIWA_DOJANG_SCROLL.slice(-4)}</span>
            {copiedContract ? <Check size={11} color="#22c55e" /> : <Copy size={11} />}
          </button>
        </div>
      </div>
    </div>
  );
};
