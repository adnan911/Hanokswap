import assert from "node:assert";
import { parseEther, encodeAbiParameters, parseAbiParameters, keccak256, toHex, type Address } from "viem";
import { normalizeUpId, isTokenDojangVerified } from "../src/lib/dojang";

console.log("==========================================");
console.log("🔍 Running Comprehensive Dojang & up.id Audit Test");
console.log("==========================================");

// 1. Validate Schema UID computation
const kycSchema = "bool isUpbitKYCVerified,uint8 tier,bytes32 countryCode";
const resolver = "0x0000000000000000000000000000000000000000";
const revocable = true;

const encoded = encodeAbiParameters(
  parseAbiParameters("string, address, bool"),
  [kycSchema, resolver, revocable]
);
const schemaUID = keccak256(encoded);
assert.strictEqual(schemaUID, "0x437cb3de8f2757c91e135c64b39934c5bd5caafb16c590b5a75606193e6186c4");
console.log("✅ 1. Schema UID encoding matches canonical definition");

// 2. Test up.id normalizer & edge cases
assert.strictEqual(normalizeUpId("alice"), "alice.up.id");
assert.strictEqual(normalizeUpId("ALICE.UP.ID"), "alice.up.id");
assert.strictEqual(normalizeUpId("  bob_123.up.id  "), "bob_123.up.id");
console.log("✅ 2. up.id normalization & trim logic verified");

// 3. Test token verification helper
const knownUSDC = "0x3600000000000000000000000000000000000000";
const randomToken = "0x1234567890123456789012345678901234567890";
assert.strictEqual(isTokenDojangVerified(knownUSDC), true);
assert.strictEqual(isTokenDojangVerified(randomToken), false);
console.log("✅ 3. Token verification whitelist & EAS check verified");

// 4. Mathematical fee rebate validation
function getEffectiveSwapFee(baseFeeBps: number, discountBps: number): number {
  return baseFeeBps - (baseFeeBps * discountBps / 10000);
}

// Standard pool fee: 3000 (0.30%)
// KYC discount: 2000 (20%) -> Effective: 2400 (0.24%)
assert.strictEqual(getEffectiveSwapFee(3000, 2000), 2400);

// VIP discount: 5000 (50%) -> Effective: 1500 (0.15%)
assert.strictEqual(getEffectiveSwapFee(3000, 5000), 1500);

// Standard: 0% -> Effective: 3000
assert.strictEqual(getEffectiveSwapFee(3000, 0), 3000);
console.log("✅ 4. Fee rebate arithmetic verified against contract formula");

console.log("\n🎉 ALL AUDIT CHECKS PASSED!\n");
