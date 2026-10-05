import React from "react";
import { ShieldCheck, Sparkles, Award } from "lucide-react";
import { type UserDojangProfile, formatUpIdDisplay } from "../lib/dojang";

interface UpIdBadgeProps {
  profile: UserDojangProfile;
  onClick?: () => void;
  showDiscount?: boolean;
}

export const UpIdBadge: React.FC<UpIdBadgeProps> = ({ profile, onClick, showDiscount = true }) => {
  const isVerified = profile.isKYCVerified || profile.isVIPTrader;
  const isVIP = profile.isVIPTrader;

  let bg = "var(--muted, rgba(255, 255, 255, 0.05))";
  let border = "1px solid var(--border, rgba(255, 255, 255, 0.12))";
  let color = "var(--foreground, #ffffff)";
  let glow = "none";

  if (isVIP) {
    bg = "linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.25) 100%)";
    border = "1px solid rgba(245, 158, 11, 0.45)";
    color = "#fbbf24";
    glow = "0 2px 10px rgba(245, 158, 11, 0.2)";
  } else if (isVerified) {
    bg = "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.25) 100%)";
    border = "1px solid rgba(59, 130, 246, 0.45)";
    color = "#60a5fa";
    glow = "0 2px 10px rgba(59, 130, 246, 0.2)";
  }

  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 11px",
        borderRadius: 20,
        background: bg,
        border: border,
        color: color,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: glow,
        backdropFilter: "blur(8px)",
      }}
      title={
        isVIP
          ? "Dunamu VIP Institutional Tier (50% Fee Rebate)"
          : isVerified
          ? "Upbit KYC Verified (20% Fee Rebate)"
          : "Click to claim up.id or verify on Dojang"
      }
    >
      {isVIP ? (
        <Award size={14} style={{ color: "#f59e0b" }} />
      ) : isVerified ? (
        <ShieldCheck size={14} style={{ color: "#3b82f6" }} />
      ) : (
        <Sparkles size={14} style={{ color: "var(--primary, #fb923c)" }} />
      )}

      <span style={{ letterSpacing: "-0.01em" }}>
        {profile.upIdName ? formatUpIdDisplay(profile.upIdName) : "Claim up.id"}
      </span>

      {showDiscount && profile.feeDiscountPercent > 0 && (
        <span
          style={{
            marginLeft: 2,
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 10,
            background: isVIP ? "rgba(245, 158, 11, 0.3)" : "rgba(59, 130, 246, 0.3)",
            color: isVIP ? "#fef3c7" : "#dbeafe",
            fontWeight: 800,
          }}
        >
          -{profile.feeDiscountPercent}%
        </span>
      )}
    </button>
  );
};
