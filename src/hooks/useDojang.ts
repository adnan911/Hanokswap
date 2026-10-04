import { useState, useEffect, useCallback } from "react";
import { type Address } from "viem";
import {
  getUserDojangProfile,
  registerUpId,
  mockIssueDojangAttestation,
  type UserDojangProfile,
} from "../lib/dojang";

export function useDojang(address: Address | undefined) {
  const [profile, setProfile] = useState<UserDojangProfile>({
    address: address || ("0x0000000000000000000000000000000000000000" as Address),
    upIdName: null,
    isKYCVerified: false,
    isVIPTrader: false,
    activeTier: "NONE",
    feeDiscountPercent: 0,
    attestations: [],
  });
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProfile = useCallback(async () => {
    if (!address) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = await getUserDojangProfile(address);
      setProfile(p);
    } catch (e) {
      console.error("Failed to load Dojang profile:", e);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refreshProfile();

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ address: Address }>;
      if (!customEvent.detail?.address || (address && customEvent.detail.address.toLowerCase() === address.toLowerCase())) {
        refreshProfile();
      }
    };

    window.addEventListener("dojang_profile_updated", handleUpdate);
    return () => {
      window.removeEventListener("dojang_profile_updated", handleUpdate);
    };
  }, [address, refreshProfile]);

  const claimUpId = async (name: string) => {
    if (!address) throw new Error("Wallet not connected");
    const res = await registerUpId(name, address);
    if (res.success) {
      await refreshProfile();
    }
    return res;
  };

  const mintTestnetAttestation = async (tier: "UPBIT_KYC" | "DUNAMU_VIP") => {
    if (!address) throw new Error("Wallet not connected");
    const att = await mockIssueDojangAttestation(address, tier);
    await refreshProfile();
    return att;
  };

  return {
    profile,
    loading,
    refreshProfile,
    claimUpId,
    mintTestnetAttestation,
  };
}
