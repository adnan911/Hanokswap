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
        backgroundColor: "rgba(5, 7, 15, 0.82)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "560px",
          background: "linear-gradient(180deg, #16192b 0%, #0d0f1a 100%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "20px",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(99, 102, 241, 0.15)",
          padding: "24px 26px",
          maxHeight: "90vh",
          overflowY: "auto",
          color: "#ffffff",
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
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(59, 130, 246, 0.35)",
                color: "#ffffff",
                fontWeight: 900,
                fontSize: "18px",
                userSelect: "none",
              }}
            >
              印
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em" }}>
                  Dojang Identity & up.id
                </h2>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: "20px",
                    background: "rgba(59, 130, 246, 0.15)",
                    border: "1px solid rgba(59, 130, 246, 0.35)",
                    color: "#60a5fa",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  EAS Native
                </span>
              </div>
              <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "rgba(255, 255, 255, 0.55)" }}>
                Dunamu's on-chain attestation engine & Web3 name service
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "10px",
              padding: "6px",
              color: "rgba(255, 255, 255, 0.6)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#ffffff";
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
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
              padding: "10px 14px",
              borderRadius: "10px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              fontSize: "12px",
              lineHeight: 1.4,
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
            borderRadius: "14px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.07)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Row 1: Connected Wallet */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255, 255, 255, 0.5)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Connected Wallet
            </span>
            <button
              onClick={copyAddress}
              disabled={!address}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                background: "transparent",
                border: "none",
                color: "#60a5fa",
                fontSize: "12px",
                fontWeight: 600,
                cursor: address ? "pointer" : "default",
                padding: "2px 6px",
                borderRadius: "6px",
                transition: "background 0.2s",
              }}
            >
              {copied ? <Check size={13} style={{ color: "#4ade80" }} /> : <Copy size={13} />}
              <span>
                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}
              </span>
              {copied && <span style={{ color: "#4ade80", fontSize: "10px", fontWeight: 700 }}>(Copied)</span>}
            </button>
          </div>

          <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.06)" }} />

          {/* Row 2: Name & Fee Discount */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.5)", fontWeight: 600 }}>Primary up.id Handle</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                {profile.upIdName ? (
                  <>
                    <span
                      style={{
                        fontSize: "15px",
                        fontWeight: 800,
                        background: "linear-gradient(90deg, #60a5fa 0%, #a5b4fc 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      {profile.upIdName}.up.id
                    </span>
                    <CheckCircle2 size={15} style={{ color: "#60a5fa" }} />
                  </>
                ) : (
                  <span style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.4)", fontStyle: "italic" }}>
                    No up.id registered yet
                  </span>
                )}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.5)", fontWeight: 600 }}>Fee Rebate Status</span>
              <div style={{ marginTop: "3px" }}>
                {profile.feeDiscountPercent > 0 ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      fontWeight: 800,
                      padding: "3px 8px",
                      borderRadius: "6px",
                      background: profile.isVIPTrader ? "rgba(245, 158, 11, 0.18)" : "rgba(34, 197, 94, 0.18)",
                      border: profile.isVIPTrader ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(34, 197, 94, 0.4)",
                      color: profile.isVIPTrader ? "#fcd34d" : "#4ade80",
                    }}
                  >
                    <Zap size={11} /> -{profile.feeDiscountPercent}% Rebate Active
                  </span>
                ) : (
                  <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.5)" }}>Standard 0%</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Claim / Register up.id Form */}
        <div style={{ marginTop: "18px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 700,
              color: "rgba(255, 255, 255, 0.85)",
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
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "12px",
                  padding: "10px 65px 10px 14px",
                  color: "#ffffff",
                  fontSize: "13px",
                  outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#3b82f6";
                  e.currentTarget.style.boxShadow = "0 0 0 2px rgba(59, 130, 246, 0.2)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <span
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "rgba(255, 255, 255, 0.4)",
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
                gap: "5px",
                padding: "10px 18px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
                border: "none",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 700,
                cursor: (claiming || !address || !nameInput.trim()) ? "not-allowed" : "pointer",
                opacity: (claiming || !address || !nameInput.trim()) ? 0.5 : 1,
                boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              <Sparkles size={13} />
              {claiming ? "Claiming..." : "Claim"}
            </button>
          </form>
        </div>

        {/* Dojang Attestation Records */}
        <div style={{ marginTop: "22px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "rgba(255, 255, 255, 0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Dojang EAS Attestation Records
            </span>
            <span style={{ fontSize: "11px", color: "#60a5fa", fontWeight: 600 }}>
              Dynamic Gas & Fee Rebates
            </span>
          </div>

          {/* Attestation 1: Upbit KYC */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
              background: profile.isKYCVerified
                ? "linear-gradient(135deg, rgba(30, 58, 138, 0.25) 0%, rgba(15, 23, 42, 0.5) 100%)"
                : "rgba(255, 255, 255, 0.025)",
              border: profile.isKYCVerified
                ? "1px solid rgba(59, 130, 246, 0.45)"
                : "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              transition: "all 0.2s",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: 1 }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: profile.isKYCVerified ? "rgba(59, 130, 246, 0.2)" : "rgba(255, 255, 255, 0.05)",
                  color: profile.isKYCVerified ? "#60a5fa" : "rgba(255, 255, 255, 0.4)",
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
                  <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
                    Upbit KYC Level 2 Attestation
                  </h4>
                  {profile.isKYCVerified && (
                    <span
                      style={{
                        fontSize: "9px",
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
                <p style={{ margin: "3px 0 0 0", fontSize: "11.5px", color: "rgba(255, 255, 255, 0.6)", lineHeight: 1.35 }}>
                  Unlocks <strong style={{ color: "#93c5fd" }}>20% dynamic swap fee discount</strong> & compliance pool access.
                </p>
              </div>
            </div>

            <div>
              {!profile.isKYCVerified ? (
                <button
                  onClick={() => handleMint("UPBIT_KYC")}
                  disabled={minting !== null || !address}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "10px",
                    background: "rgba(59, 130, 246, 0.15)",
                    border: "1px solid rgba(59, 130, 246, 0.4)",
                    color: "#93c5fd",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: (minting !== null || !address) ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) e.currentTarget.style.background = "rgba(59, 130, 246, 0.3)";
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
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#4ade80",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Check size={13} /> -20% Active
                </span>
              )}
            </div>
          </div>

          {/* Attestation 2: Dunamu VIP Tier */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
              background: profile.isVIPTrader
                ? "linear-gradient(135deg, rgba(120, 53, 15, 0.25) 0%, rgba(15, 23, 42, 0.5) 100%)"
                : "rgba(255, 255, 255, 0.025)",
              border: profile.isVIPTrader
                ? "1px solid rgba(245, 158, 11, 0.45)"
                : "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              transition: "all 0.2s",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: 1 }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: profile.isVIPTrader ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.05)",
                  color: profile.isVIPTrader ? "#fbbf24" : "rgba(255, 255, 255, 0.4)",
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
                  <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
                    Dunamu VIP Institutional Tier
                  </h4>
                  {profile.isVIPTrader && (
                    <span
                      style={{
                        fontSize: "9px",
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
                <p style={{ margin: "3px 0 0 0", fontSize: "11.5px", color: "rgba(255, 255, 255, 0.6)", lineHeight: 1.35 }}>
                  Unlocks <strong style={{ color: "#fde68a" }}>50% maximum swap fee rebate</strong> & priority block inclusion.
                </p>
              </div>
            </div>

            <div>
              {!profile.isVIPTrader ? (
                <button
                  onClick={() => handleMint("DUNAMU_VIP")}
                  disabled={minting !== null || !address}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "10px",
                    background: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid rgba(245, 158, 11, 0.4)",
                    color: "#fde68a",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: (minting !== null || !address) ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) e.currentTarget.style.background = "rgba(245, 158, 11, 0.3)";
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
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#f59e0b",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Check size={13} /> -50% Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div
          style={{
            marginTop: "20px",
            paddingTop: "14px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "rgba(255, 255, 255, 0.5)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <Zap size={13} style={{ color: "#60a5fa" }} />
            Giwa Sepolia (Chain ID: 91342)
          </span>
          <button
            onClick={copyContract}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255, 255, 255, 0.5)",
              fontSize: "11px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
            title="Click to copy DojangScroll contract address"
          >
            <span>DojangScroll EAS Core: {GIWA_DOJANG_SCROLL.slice(0, 6)}...{GIWA_DOJANG_SCROLL.slice(-4)}</span>
            {copiedContract ? <Check size={11} style={{ color: "#4ade80" }} /> : <Copy size={11} />}
          </button>
        </div>
      </div>
    </div>
  );
};
