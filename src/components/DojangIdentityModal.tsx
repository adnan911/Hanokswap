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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#12141f] border border-blue-500/30 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-lg">
              印
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Dojang Identity & up.id
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-medium">
                  EAS Native
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Dunamu's on-chain attestation engine (`giwa-io/dojang`) & Web3 name service
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* User Card */}
        <div className="mt-5 p-4 rounded-xl bg-gray-900/80 border border-gray-800 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              Connected Wallet
            </span>
            <button
              onClick={copyAddress}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-800/60">
            <div>
              <span className="text-xs text-gray-400">Primary up.id Name</span>
              <div className="text-base font-bold text-white flex items-center gap-1.5 mt-0.5">
                {profile.upIdName ? (
                  <>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
                      {profile.upIdName}
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  </>
                ) : (
                  <span className="text-gray-500 text-sm italic">No up.id registered</span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-gray-400">Fee Rebate Status</span>
              <div className="text-sm font-bold text-green-400 mt-0.5">
                {profile.feeDiscountPercent > 0 ? (
                  <span className="px-2 py-0.5 rounded-md bg-green-500/20 border border-green-500/30">
                    -{profile.feeDiscountPercent}% Rebate Active
                  </span>
                ) : (
                  <span className="text-gray-400 font-normal">Standard 0%</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Claim / Register up.id */}
        <div className="mt-5">
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">
            {profile.upIdName ? "Register Additional / Switch up.id" : "Claim Your Free up.id Handle"}
          </label>
          <form onSubmit={handleClaim} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Satoshi or your_name"
                disabled={claiming || !address}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors pr-20"
              />
              <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium select-none">
                .up.id
              </span>
            </div>
            <button
              type="submit"
              disabled={claiming || !address || !nameInput.trim()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-blue-600/20"
            >
              {claiming ? "Registering..." : "Claim"}
            </button>
          </form>
        </div>

        {/* Dojang Attestations Breakdown */}
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
            Dojang EAS Attestation Records
          </h3>

          {/* Upbit KYC Attestation */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            profile.isKYCVerified
              ? "bg-blue-950/20 border-blue-500/40"
              : "bg-gray-900/40 border-gray-800"
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${profile.isKYCVerified ? "bg-blue-500/20 text-blue-400" : "bg-gray-800 text-gray-500"}`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Upbit KYC Level 2 Attestation
                    {profile.isKYCVerified && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-300 font-semibold">
                        VERIFIED
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Unlocks **20% dynamic swap fee discount** & access to Dojang-gated compliance pools.
                  </p>
                </div>
              </div>

              {!profile.isKYCVerified ? (
                <button
                  onClick={() => handleMint("UPBIT_KYC")}
                  disabled={minting !== null || !address}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-blue-300 text-xs font-semibold transition-all"
                >
                  {minting === "UPBIT_KYC" ? "Issuing..." : "Simulate KYC"}
                </button>
              ) : (
                <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> -20% Fee Active
                </span>
              )}
            </div>
          </div>

          {/* Dunamu VIP Tier Attestation */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            profile.isVIPTrader
              ? "bg-amber-950/20 border-amber-500/40"
              : "bg-gray-900/40 border-gray-800"
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${profile.isVIPTrader ? "bg-amber-500/20 text-amber-400" : "bg-gray-800 text-gray-500"}`}>
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Dunamu VIP Institutional Tier
                    {profile.isVIPTrader && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 font-semibold">
                        VIP ACTIVE
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Unlocks **50% maximum swap fee rebate** & priority block inclusion.
                  </p>
                </div>
              </div>

              {!profile.isVIPTrader ? (
                <button
                  onClick={() => handleMint("DUNAMU_VIP")}
                  disabled={minting !== null || !address}
                  className="px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/40 text-amber-300 text-xs font-semibold transition-all"
                >
                  {minting === "DUNAMU_VIP" ? "Upgrading..." : "Simulate VIP"}
                </button>
              ) : (
                <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> -50% Fee Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            Giwa Sepolia (Chain ID: 91342)
          </span>
          <span className="text-[11px] text-gray-400">
            DojangScroll EAS Core: {GIWA_DOJANG_SCROLL.slice(0, 8)}...
          </span>
        </div>
      </div>
    </div>
  );
};
