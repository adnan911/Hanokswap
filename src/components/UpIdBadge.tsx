import React from "react";
import { ShieldCheck, Sparkles, Award } from "lucide-react";
import { type UserDojangProfile } from "../lib/dojang";

interface UpIdBadgeProps {
  profile: UserDojangProfile;
  onClick?: () => void;
  showDiscount?: boolean;
}

export const UpIdBadge: React.FC<UpIdBadgeProps> = ({ profile, onClick, showDiscount = true }) => {
  const isVerified = profile.isKYCVerified || profile.isVIPTrader;
  const isVIP = profile.isVIPTrader;

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide transition-all border ${
        isVIP
          ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-500/40 text-amber-300 hover:border-amber-400 hover:shadow-amber-500/20 hover:shadow-sm"
          : isVerified
          ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/40 text-blue-300 hover:border-blue-400 hover:shadow-blue-500/20 hover:shadow-sm"
          : "bg-gray-800/80 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
      }`}
      title={
        isVIP
          ? "Dunamu VIP Institutional Tier (50% Fee Rebate)"
          : isVerified
          ? "Upbit KYC Verified (20% Fee Rebate)"
          : "Click to claim up.id or verify on Dojang"
      }
    >
      {isVIP ? (
        <Award className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
      ) : isVerified ? (
        <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
      ) : (
        <Sparkles className="w-3.5 h-3.5 text-gray-400" />
      )}

      <span>{profile.upIdName || "Claim up.id"}</span>

      {showDiscount && profile.feeDiscountPercent > 0 && (
        <span
          className={`ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            isVIP ? "bg-amber-500/30 text-amber-200" : "bg-blue-500/30 text-blue-200"
          }`}
        >
          -{profile.feeDiscountPercent}%
        </span>
      )}
    </button>
  );
};
