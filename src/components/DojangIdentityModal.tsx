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
} from "lucide-react";
import { useDojang } from "../hooks/useDojang";
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

  if (!isOpen) return null;

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nameInput.trim()) return;

    setClaiming(true);
    try {
      const res = await claimUpId(nameInput.trim());
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
        backgroundColor: "rgba(10, 11, 16, 0.78)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "540px",
          background: "var(--card, #1c1e26)",
          border: "1px solid var(--border, rgba(255, 255, 255, 0.12))",
          borderRadius: "22px",
          boxShadow: "0 28px 64px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05)",
          padding: "24px 26px",
          maxHeight: "92vh",
          overflowY: "auto",
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
            paddingBottom: "18px",
            borderBottom: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* Traditional Hanok Dojang Seal Motif */}
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #e11d48 0%, #ea580c 50%, var(--primary, #f97316) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 6px 18px rgba(234, 88, 12, 0.35)",
                color: "#ffffff",
                fontWeight: 900,
                fontSize: "20px",
                userSelect: "none",
                flexShrink: 0,
              }}
            >
              印
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "19px",
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    color: "var(--foreground, #ffffff)",
                  }}
                >
                  Dojang Identity & up.id
                </h2>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "20px",
                    background: "rgba(234, 88, 12, 0.15)",
                    border: "1px solid rgba(234, 88, 12, 0.4)",
                    color: "var(--primary, #fb923c)",
                    letterSpacing: "0.03em",
                  }}
                >
                  EAS Native
                </span>
              </div>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "12.5px",
                  color: "var(--muted-foreground, #a1a1aa)",
                  fontWeight: 500,
                }}
              >
                Dunamu on-chain attestation engine & Web3 name service
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "var(--muted, rgba(255, 255, 255, 0.06))",
              border: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
              borderRadius: "10px",
              padding: "7px",
              color: "var(--muted-foreground, rgba(255, 255, 255, 0.6))",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--foreground, #ffffff)";
              e.currentTarget.style.background = "var(--border, rgba(255, 255, 255, 0.12))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--muted-foreground, rgba(255, 255, 255, 0.6))";
              e.currentTarget.style.background = "var(--muted, rgba(255, 255, 255, 0.06))";
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div
            style={{
              marginTop: "16px",
              padding: "11px 14px",
              borderRadius: "12px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              color: "#fca5a5",
              fontSize: "12.5px",
              lineHeight: 1.4,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {/* User Profile Card */}
        <div
          style={{
            marginTop: "18px",
            padding: "16px 18px",
            borderRadius: "16px",
            background: "var(--muted, #14151b)",
            border: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {/* Row 1: Connected Wallet */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "var(--muted-foreground, #a1a1aa)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Connected Wallet
            </span>
            <button
              onClick={copyAddress}
              disabled={!address}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
                color: "var(--primary, #fb923c)",
                fontSize: "12px",
                fontWeight: 700,
                cursor: address ? "pointer" : "default",
                padding: "4px 10px",
                borderRadius: "8px",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (address) e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
              }}
              onMouseLeave={(e) => {
                if (address) e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
              }}
            >
              {copied ? <Check size={13} style={{ color: "#22c55e" }} /> : <Copy size={13} />}
              <span>
                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}
              </span>
              {copied && <span style={{ color: "#22c55e", fontSize: "11px", fontWeight: 800 }}>Copied!</span>}
            </button>
          </div>

          <div style={{ height: "1px", background: "var(--border, rgba(255, 255, 255, 0.06))" }} />

          {/* Row 2: Name & Fee Discount */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--muted-foreground, #a1a1aa)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Primary up.id Handle
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                {profile.upIdName ? (
                  <>
                    <span
                      style={{
                        fontSize: "15px",
                        fontWeight: 800,
                        color: "var(--primary, #fb923c)",
                      }}
                    >
                      {profile.upIdName}.up.id
                    </span>
                    <CheckCircle2 size={16} style={{ color: "#22c55e" }} />
                  </>
                ) : (
                  <span
                    style={{
                      fontSize: "13px",
                      color: "var(--muted-foreground, rgba(255, 255, 255, 0.45))",
                      fontStyle: "italic",
                    }}
                  >
                    No up.id registered yet
                  </span>
                )}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--muted-foreground, #a1a1aa)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Fee Rebate Status
              </span>
              <div style={{ marginTop: "4px" }}>
                {profile.feeDiscountPercent > 0 ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11.5px",
                      fontWeight: 800,
                      padding: "3px 9px",
                      borderRadius: "6px",
                      background: profile.isVIPTrader ? "rgba(245, 158, 11, 0.2)" : "rgba(34, 197, 94, 0.2)",
                      border: profile.isVIPTrader ? "1px solid rgba(245, 158, 11, 0.45)" : "1px solid rgba(34, 197, 94, 0.45)",
                      color: profile.isVIPTrader ? "#fcd34d" : "#4ade80",
                    }}
                  >
                    <Zap size={11} /> -{profile.feeDiscountPercent}% Active
                  </span>
                ) : (
                  <span style={{ fontSize: "13px", color: "var(--muted-foreground, #a1a1aa)", fontWeight: 600 }}>
                    Standard 0%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Claim / Register up.id Form */}
        <div style={{ marginTop: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 800,
              color: "var(--foreground, #ffffff)",
              marginBottom: "8px",
            }}
          >
            {profile.upIdName ? "Register Additional / Switch up.id" : "Claim Your Free up.id Handle"}
          </label>
          <form onSubmit={handleClaim} style={{ display: "flex", gap: "8px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. satoshi or your_name"
                disabled={claiming || !address}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "var(--muted, #14151b)",
                  border: "1px solid var(--border, rgba(255, 255, 255, 0.12))",
                  borderRadius: "14px",
                  padding: "12px 68px 12px 14px",
                  color: "var(--foreground, #ffffff)",
                  fontSize: "13.5px",
                  outline: "none",
                  transition: "all 0.2s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary, #f97316)";
                  e.currentTarget.style.boxShadow = "0 0 0 2px rgba(234, 88, 12, 0.2)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border, rgba(255, 255, 255, 0.12))";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <span
                style={{
                  position: "absolute",
                  right: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "var(--muted-foreground, #71717a)",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              >
                .up.id
              </span>
            </div>
            <button
              type="submit"
              disabled={claiming || !address || !nameInput.trim()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "12px 20px",
                borderRadius: "14px",
                background: "var(--primary, #f97316)",
                border: "none",
                color: "#ffffff",
                fontSize: "13.5px",
                fontWeight: 800,
                cursor: (claiming || !address || !nameInput.trim()) ? "not-allowed" : "pointer",
                opacity: (claiming || !address || !nameInput.trim()) ? 0.5 : 1,
                boxShadow: "0 6px 18px oklch(0.6724 0.1308 38.7559 / 0.35)",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
              }}
            >
              <Sparkles size={14} />
              {claiming ? "Claiming..." : "Claim"}
            </button>
          </form>
        </div>

        {/* Dojang Attestation Records */}
        <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "11.5px",
                fontWeight: 800,
                color: "var(--muted-foreground, #a1a1aa)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Dojang EAS Attestation Records
            </span>
            <span
              style={{
                fontSize: "11.5px",
                color: "var(--primary, #fb923c)",
                fontWeight: 700,
              }}
            >
              Dynamic Gas & Fee Rebates
            </span>
          </div>

          {/* Attestation 1: Upbit KYC */}
          <div
            style={{
              padding: "15px 16px",
              borderRadius: "15px",
              background: profile.isKYCVerified
                ? "rgba(59, 130, 246, 0.08)"
                : "var(--muted, #14151b)",
              border: profile.isKYCVerified
                ? "1px solid rgba(59, 130, 246, 0.4)"
                : "1px solid var(--border, rgba(255, 255, 255, 0.08))",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: 1 }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: profile.isKYCVerified ? "rgba(59, 130, 246, 0.2)" : "rgba(255, 255, 255, 0.05)",
                  color: profile.isKYCVerified ? "#60a5fa" : "var(--muted-foreground, #71717a)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ShieldCheck size={20} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <h4 style={{ margin: 0, fontSize: "13.5px", fontWeight: 800, color: "var(--foreground, #ffffff)" }}>
                    Upbit KYC Level 2 Attestation
                  </h4>
                  {profile.isKYCVerified && (
                    <span
                      style={{
                        fontSize: "9.5px",
                        fontWeight: 800,
                        padding: "1px 6px",
                        borderRadius: "4px",
                        background: "rgba(59, 130, 246, 0.25)",
                        color: "#93c5fd",
                      }}
                    >
                      VERIFIED
                    </span>
                  )}
                </div>
                <p
                  style={{
                    margin: "3px 0 0 0",
                    fontSize: "12px",
                    color: "var(--muted-foreground, #a1a1aa)",
                    lineHeight: 1.4,
                  }}
                >
                  Unlocks <strong style={{ color: "#60a5fa" }}>20% dynamic swap fee discount</strong> & compliance pool access.
                </p>
              </div>
            </div>

            <div>
              {!profile.isKYCVerified ? (
                <button
                  onClick={() => handleMint("UPBIT_KYC")}
                  disabled={minting !== null || !address}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "10px",
                    background: "rgba(59, 130, 246, 0.15)",
                    border: "1px solid rgba(59, 130, 246, 0.4)",
                    color: "#93c5fd",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    cursor: (minting !== null || !address) ? "not-allowed" : "pointer",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) e.currentTarget.style.background = "rgba(59, 130, 246, 0.28)";
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) e.currentTarget.style.background = "rgba(59, 130, 246, 0.15)";
                  }}
                >
                  {minting === "UPBIT_KYC" ? "Issuing..." : "Simulate KYC"}
                </button>
              ) : (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#22c55e",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Check size={14} /> -20% Active
                </span>
              )}
            </div>
          </div>

          {/* Attestation 2: Dunamu VIP Tier */}
          <div
            style={{
              padding: "15px 16px",
              borderRadius: "15px",
              background: profile.isVIPTrader
                ? "rgba(245, 158, 11, 0.08)"
                : "var(--muted, #14151b)",
              border: profile.isVIPTrader
                ? "1px solid rgba(245, 158, 11, 0.4)"
                : "1px solid var(--border, rgba(255, 255, 255, 0.08))",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: 1 }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: profile.isVIPTrader ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.05)",
                  color: profile.isVIPTrader ? "#fbbf24" : "var(--muted-foreground, #71717a)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Award size={20} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <h4 style={{ margin: 0, fontSize: "13.5px", fontWeight: 800, color: "var(--foreground, #ffffff)" }}>
                    Dunamu VIP Institutional Tier
                  </h4>
                  {profile.isVIPTrader && (
                    <span
                      style={{
                        fontSize: "9.5px",
                        fontWeight: 800,
                        padding: "1px 6px",
                        borderRadius: "4px",
                        background: "rgba(245, 158, 11, 0.25)",
                        color: "#fde68a",
                      }}
                    >
                      VIP ACTIVE
                    </span>
                  )}
                </div>
                <p
                  style={{
                    margin: "3px 0 0 0",
                    fontSize: "12px",
                    color: "var(--muted-foreground, #a1a1aa)",
                    lineHeight: 1.4,
                  }}
                >
                  Unlocks <strong style={{ color: "#fbbf24" }}>50% maximum swap fee rebate</strong> & priority block inclusion.
                </p>
              </div>
            </div>

            <div>
              {!profile.isVIPTrader ? (
                <button
                  onClick={() => handleMint("DUNAMU_VIP")}
                  disabled={minting !== null || !address}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "10px",
                    background: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid rgba(245, 158, 11, 0.45)",
                    color: "#fde68a",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    cursor: (minting !== null || !address) ? "not-allowed" : "pointer",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) e.currentTarget.style.background = "rgba(245, 158, 11, 0.28)";
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) e.currentTarget.style.background = "rgba(245, 158, 11, 0.15)";
                  }}
                >
                  {minting === "DUNAMU_VIP" ? "Upgrading..." : "Simulate VIP"}
                </button>
              ) : (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#f59e0b",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Check size={14} /> -50% Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div
          style={{
            marginTop: "22px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "11.5px",
            color: "var(--muted-foreground, #a1a1aa)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Zap size={13} style={{ color: "var(--primary, #fb923c)" }} />
            Giwa Sepolia (Chain ID: 91342)
          </span>
          <button
            onClick={copyContract}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted-foreground, #a1a1aa)",
              fontSize: "11.5px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 4px",
              borderRadius: "4px",
            }}
            title="Click to copy DojangScroll contract address"
          >
            <span>DojangScroll EAS Core: {GIWA_DOJANG_SCROLL.slice(0, 6)}...{GIWA_DOJANG_SCROLL.slice(-4)}</span>
            {copiedContract ? <Check size={12} style={{ color: "#22c55e" }} /> : <Copy size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
};
