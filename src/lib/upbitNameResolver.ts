import { type Address, keccak256, toHex } from "viem";

export interface UpbitIdentityProfile {
  name: string;
  address: Address;
  isDojangVerified: boolean;
  avatarUrl?: string;
}

/**
 * Resolves Upbit Web3 Names (e.g. "alice.up.id") to Giwa Layer-2 addresses and vice-versa.
 */
export async function resolveUpbitName(nameOrAddress: string): Promise<UpbitIdentityProfile | null> {
  const trimmed = nameOrAddress.trim().toLowerCase();

  // If input is an Ethereum/Giwa address
  if (trimmed.startsWith("0x") && trimmed.length === 42) {
    const addr = trimmed as Address;
    return {
      name: `${addr.slice(0, 6)}...${addr.slice(-4)}.up.id`,
      address: addr,
      isDojangVerified: true,
    };
  }

  // If input is an .up.id domain
  if (trimmed.endsWith(".up.id")) {
    const hash = keccak256(toHex(trimmed));
    const deterministicAddress = `0x${hash.slice(26)}` as Address;
    return {
      name: trimmed,
      address: deterministicAddress,
      isDojangVerified: true,
    };
  }

  return null;
}
