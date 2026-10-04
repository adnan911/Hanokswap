import { type Address, keccak256, toHex } from "viem";
import {
  DOJANG_KYC_SCHEMA_UID,
  DOJANG_VIP_SCHEMA_UID,
  DOJANG_PROJECT_VERIFIED_SCHEMA_UID,
  GIWA_DUNAMU_OFFICIAL_ATTESTER,
} from "../contracts";

export interface DojangAttestation {
  uid: string;
  schema: string;
  schemaType: 'UPBIT_KYC' | 'DUNAMU_VIP' | 'PROJECT_VERIFIED';
  recipient: Address;
  attester: Address;
  time: number;
  expirationTime: number;
  revoked: boolean;
  tierName: string;
  discountBps: number; // e.g. 2000 for 20%
}

export interface UserDojangProfile {
  address: Address;
  upIdName: string | null;
  isKYCVerified: boolean;
  isVIPTrader: boolean;
  activeTier: 'NONE' | 'UPBIT_KYC' | 'DUNAMU_VIP';
  feeDiscountPercent: number; // 0%, 20%, 50%
  attestations: DojangAttestation[];
}

const UP_ID_STORAGE_KEY = "hanokswap_up_id_registry_v1";
const DOJANG_ATTESTATIONS_KEY = "hanokswap_dojang_attestations_v1";

// In-memory / localStorage fallback registry for instant sub-second lookup
function getStoredUpIds(): Record<string, { target: Address; owner: Address }> {
  try {
    const raw = localStorage.getItem(UP_ID_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {
      "dunamu.up.id": { target: "0x89C10000000000000000000000000000000000AA" as Address, owner: "0x89C10000000000000000000000000000000000AA" as Address },
      "hanokswap.up.id": { target: "0xde7e4fdaaef35680adb15f026a5087801366c316" as Address, owner: "0xde7e4fdaaef35680adb15f026a5087801366c316" as Address },
      "whale.up.id": { target: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address, owner: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address },
    };
  } catch {
    return {};
  }
}

function getStoredAttestations(): Record<string, DojangAttestation[]> {
  try {
    const raw = localStorage.getItem(DOJANG_ATTESTATIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function normalizeUpId(name: string): string {
  let cleaned = name.trim().toLowerCase();
  if (!cleaned.endsWith(".up.id")) {
    cleaned = `${cleaned}.up.id`;
  }
  return cleaned;
}

/**
 * Forward Resolve: alice.up.id -> 0x123...
 */
export async function resolveUpId(name: string): Promise<Address | null> {
  const normalized = normalizeUpId(name);
  const map = getStoredUpIds();
  return map[normalized]?.target || null;
}

/**
 * Reverse Resolve: 0x123... -> alice.up.id
 */
export async function resolveAddressToUpId(address: Address): Promise<string | null> {
  const map = getStoredUpIds();
  const lower = address.toLowerCase();
  for (const [name, data] of Object.entries(map)) {
    if (data.target.toLowerCase() === lower) {
      return name;
    }
  }
  return null;
}

/**
 * Register a new .up.id name for target address
 */
export async function registerUpId(name: string, target: Address): Promise<{ success: boolean; name: string; error?: string }> {
  const normalized = normalizeUpId(name);
  const rawPrefix = normalized.replace(/\.up\.id$/, "");
  
  if (rawPrefix.length < 2) {
    return { success: false, name: normalized, error: "Name must be at least 2 characters" };
  }
  if (!/^[a-z0-9-_]+$/.test(rawPrefix)) {
    return { success: false, name: normalized, error: "Name can only contain lowercase alphanumeric characters, dashes, and underscores" };
  }

  const map = getStoredUpIds();
  if (map[normalized] && map[normalized].target.toLowerCase() !== target.toLowerCase()) {
    return { success: false, name: normalized, error: `Name ${normalized} is already registered to another address` };
  }

  map[normalized] = { target, owner: target };
  localStorage.setItem(UP_ID_STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent("dojang_profile_updated", { detail: { address: target } }));

  return { success: true, name: normalized };
}

/**
 * Fetch full Dojang Attestation profile for a user address
 */
export async function getUserDojangProfile(address: Address | undefined): Promise<UserDojangProfile> {
  if (!address) {
    return {
      address: "0x0000000000000000000000000000000000000000",
      upIdName: null,
      isKYCVerified: false,
      isVIPTrader: false,
      activeTier: 'NONE',
      feeDiscountPercent: 0,
      attestations: [],
    };
  }

  const upIdName = await resolveAddressToUpId(address);
  const allAttestations = getStoredAttestations();
  const userAtts = allAttestations[address.toLowerCase()] || [];

  const now = Math.floor(Date.now() / 1000);
  const validAtts = userAtts.filter((a) => !a.revoked && (a.expirationTime === 0 || a.expirationTime > now));

  const hasVIP = validAtts.some((a) => a.schemaType === 'DUNAMU_VIP');
  const hasKYC = hasVIP || validAtts.some((a) => a.schemaType === 'UPBIT_KYC');

  let activeTier: 'NONE' | 'UPBIT_KYC' | 'DUNAMU_VIP' = 'NONE';
  let feeDiscountPercent = 0;

  if (hasVIP) {
    activeTier = 'DUNAMU_VIP';
    feeDiscountPercent = 50; // 50% discount
  } else if (hasKYC) {
    activeTier = 'UPBIT_KYC';
    feeDiscountPercent = 20; // 20% discount
  }

  return {
    address,
    upIdName,
    isKYCVerified: hasKYC,
    isVIPTrader: hasVIP,
    activeTier,
    feeDiscountPercent,
    attestations: validAtts,
  };
}

/**
 * Self-service / Dunamu Testnet KYC Minter
 * Allows users to mint mock Dunamu Dojang EAS attestations on Giwa testnet to test features
 */
export async function mockIssueDojangAttestation(
  recipient: Address,
  type: 'UPBIT_KYC' | 'DUNAMU_VIP' | 'PROJECT_VERIFIED'
): Promise<DojangAttestation> {
  const allAttestations = getStoredAttestations();
  const key = recipient.toLowerCase();
  if (!allAttestations[key]) {
    allAttestations[key] = [];
  }

  const now = Math.floor(Date.now() / 1000);
  const uid = keccak256(toHex(`${recipient}-${type}-${now}`));
  
  let schema = DOJANG_KYC_SCHEMA_UID;
  let tierName = "Upbit KYC Level 2";
  let discountBps = 2000;

  if (type === 'DUNAMU_VIP') {
    schema = DOJANG_VIP_SCHEMA_UID;
    tierName = "Dunamu VIP Institutional Tier";
    discountBps = 5000;
  } else if (type === 'PROJECT_VERIFIED') {
    schema = DOJANG_PROJECT_VERIFIED_SCHEMA_UID;
    tierName = "Dunamu Verified Token Project";
    discountBps = 0;
  }

  const newAtt: DojangAttestation = {
    uid,
    schema,
    schemaType: type,
    recipient,
    attester: GIWA_DUNAMU_OFFICIAL_ATTESTER,
    time: now,
    expirationTime: now + 365 * 24 * 3600, // 1 year validity
    revoked: false,
    tierName,
    discountBps,
  };

  // Remove duplicate schema types
  allAttestations[key] = allAttestations[key].filter((a) => a.schemaType !== type);
  allAttestations[key].push(newAtt);

  localStorage.setItem(DOJANG_ATTESTATIONS_KEY, JSON.stringify(allAttestations));
  window.dispatchEvent(new CustomEvent("dojang_profile_updated", { detail: { address: recipient } }));

  return newAtt;
}

/**
 * Check if a token address is verified by Dojang
 */
export function isTokenDojangVerified(tokenAddress: string): boolean {
  if (!tokenAddress) return false;
  const knownVerified = [
    "0x3600000000000000000000000000000000000000", // USDC
    "0x89b50855aa3be2f677cd6303cec089b5f319d72a", // EURC
    "0x89c0000000000000000000000000000000000001", // KRWC
    "0x4200000000000000000000000000000000000006", // WETH
  ];
  if (knownVerified.includes(tokenAddress.toLowerCase())) return true;

  const allAttestations = getStoredAttestations();
  const atts = allAttestations[tokenAddress.toLowerCase()] || [];
  return atts.some((a) => a.schemaType === 'PROJECT_VERIFIED' && !a.revoked);
}
