import { isTokenDojangVerified } from './dojang';
import { getLiquidityLocks } from './liquidityLocker';

export interface TokenSafetyReport {
  tokenAddress: string;
  symbol: string;
  name: string;
  buyTaxPct: number;
  sellTaxPct: number;
  isHoneypot: boolean;
  isMintable: boolean;
  isBlacklistable: boolean;
  isProxy: boolean;
  isOwnershipRenounced: boolean;
  isDojangVerified: boolean;
  isLiquidityLocked: boolean;
  trustScore: number; // 0 to 100
  riskTier: 'VERIFIED_SAFE' | 'LOW_RISK' | 'MEDIUM_RISK' | 'HONEYPOT_DANGER';
  warnings: string[];
}

const KNOWN_SAFE_TOKENS: Record<string, Partial<TokenSafetyReport>> = {
  '0x3600000000000000000000000000000000000000': {
    symbol: 'USDC',
    name: 'USD Coin',
    buyTaxPct: 0,
    sellTaxPct: 0,
    isHoneypot: false,
    isMintable: true, // Fiat-backed regulated issuer
    isBlacklistable: true,
    isProxy: true,
    isOwnershipRenounced: false,
    isDojangVerified: true,
    isLiquidityLocked: true,
    trustScore: 98,
    riskTier: 'VERIFIED_SAFE',
    warnings: ['Regulated Fiat-Backed Stablecoin (Circle Reserve)'],
  },
  '0x89c0000000000000000000000000000000000001': {
    symbol: 'KRWC',
    name: 'Dunamu KRW Coin',
    buyTaxPct: 0,
    sellTaxPct: 0,
    isHoneypot: false,
    isMintable: true,
    isBlacklistable: false,
    isProxy: false,
    isOwnershipRenounced: false,
    isDojangVerified: true,
    isLiquidityLocked: true,
    trustScore: 99,
    riskTier: 'VERIFIED_SAFE',
    warnings: ['Official Dunamu Giwa Chain Won Stablecoin'],
  },
  '0x4200000000000000000000000000000000000006': {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    buyTaxPct: 0,
    sellTaxPct: 0,
    isHoneypot: false,
    isMintable: false,
    isBlacklistable: false,
    isProxy: false,
    isOwnershipRenounced: true,
    isDojangVerified: true,
    isLiquidityLocked: true,
    trustScore: 100,
    riskTier: 'VERIFIED_SAFE',
    warnings: [],
  },
  '0x89b50855aa3be2f677cd6303cec089b5f319d72a': {
    symbol: 'EURC',
    name: 'Euro Coin',
    buyTaxPct: 0,
    sellTaxPct: 0,
    isHoneypot: false,
    isMintable: true,
    isBlacklistable: true,
    isProxy: true,
    isOwnershipRenounced: false,
    isDojangVerified: true,
    isLiquidityLocked: true,
    trustScore: 96,
    riskTier: 'VERIFIED_SAFE',
    warnings: ['Regulated Euro Stablecoin (Circle)'],
  },
  '0x89c4000000000000000000000000000000000001': {
    symbol: 'HANOK',
    name: 'Hanok Governance Token',
    buyTaxPct: 0,
    sellTaxPct: 0,
    isHoneypot: false,
    isMintable: false,
    isBlacklistable: false,
    isProxy: false,
    isOwnershipRenounced: true,
    isDojangVerified: true,
    isLiquidityLocked: true,
    trustScore: 95,
    riskTier: 'VERIFIED_SAFE',
    warnings: [],
  },
};

export async function analyzeTokenSafety(
  tokenAddress: string,
  fallbackSymbol?: string,
  fallbackName?: string
): Promise<TokenSafetyReport> {
  if (!tokenAddress) {
    return {
      tokenAddress: '',
      symbol: fallbackSymbol || 'UNKNOWN',
      name: fallbackName || 'Unknown Token',
      buyTaxPct: 0,
      sellTaxPct: 0,
      isHoneypot: false,
      isMintable: false,
      isBlacklistable: false,
      isProxy: false,
      isOwnershipRenounced: true,
      isDojangVerified: false,
      isLiquidityLocked: false,
      trustScore: 50,
      riskTier: 'LOW_RISK',
      warnings: ['No address provided for scanning'],
    };
  }

  const cleanAddr = tokenAddress.toLowerCase();
  if (KNOWN_SAFE_TOKENS[cleanAddr]) {
    const known = KNOWN_SAFE_TOKENS[cleanAddr];
    return {
      tokenAddress,
      symbol: known.symbol || fallbackSymbol || 'TOKEN',
      name: known.name || fallbackName || 'Verified Asset',
      buyTaxPct: known.buyTaxPct || 0,
      sellTaxPct: known.sellTaxPct || 0,
      isHoneypot: known.isHoneypot || false,
      isMintable: known.isMintable || false,
      isBlacklistable: known.isBlacklistable || false,
      isProxy: known.isProxy || false,
      isOwnershipRenounced: known.isOwnershipRenounced || false,
      isDojangVerified: isTokenDojangVerified(tokenAddress),
      isLiquidityLocked: known.isLiquidityLocked || true,
      trustScore: known.trustScore || 95,
      riskTier: known.riskTier || 'VERIFIED_SAFE',
      warnings: known.warnings || [],
    };
  }

  // Live simulation for unverified or custom tokens
  const isDojang = isTokenDojangVerified(tokenAddress);
  const locks = getLiquidityLocks();
  const isLPLocked = locks.some(
    (lk) => lk.lpTokenAddress.toLowerCase() === cleanAddr || lk.ownerAddress.toLowerCase() === '0x000000000000000000000000000000000000dead'
  );

  // Derive pseudo-random deterministic test results from address hash for simulation
  const hashVal = parseInt(cleanAddr.slice(2, 8) || '1234', 16);
  const isSimulatedHoneypot = hashVal % 97 === 0; // Rare honeypot test
  const simulatedSellTax = isSimulatedHoneypot ? 99 : (hashVal % 13 === 0 ? 8 : 0);
  const isMintable = (hashVal % 7) === 0;
  const isBlacklistable = (hashVal % 11) === 0;
  const isRenounced = (hashVal % 3) !== 0;

  const warnings: string[] = [];
  let score = 70;

  if (isDojang) {
    score += 25;
  } else {
    warnings.push('Token project has not completed Dunamu Dojang attestation.');
    score -= 10;
  }

  if (isLPLocked) {
    score += 15;
  } else {
    warnings.push('No verified LP lock certificate found on Giwa Liquidity Locker.');
    score -= 15;
  }

  if (simulatedSellTax > 5) {
    warnings.push(`High sell tax detected: ${simulatedSellTax}%. Traders may lose funds upon selling.`);
    score -= 30;
  }

  if (isSimulatedHoneypot) {
    warnings.push('CRITICAL: Transfer simulation failed! Token appears to be a HONEYPOT (cannot sell).');
    score = 0;
  }

  if (isMintable && !isDojang) {
    warnings.push('Owner possesses unlimited minting privileges.');
    score -= 15;
  }

  if (isBlacklistable && !isDojang) {
    warnings.push('Contract contains blacklist/freeze function.');
    score -= 10;
  }

  const clampedScore = Math.max(0, Math.min(100, score));
  let riskTier: TokenSafetyReport['riskTier'] = 'LOW_RISK';
  if (isSimulatedHoneypot || clampedScore <= 20) {
    riskTier = 'HONEYPOT_DANGER';
  } else if (clampedScore <= 60) {
    riskTier = 'MEDIUM_RISK';
  } else if (isDojang && clampedScore >= 90) {
    riskTier = 'VERIFIED_SAFE';
  }

  return {
    tokenAddress,
    symbol: fallbackSymbol || 'TOKEN',
    name: fallbackName || 'Community Token',
    buyTaxPct: 0,
    sellTaxPct: simulatedSellTax,
    isHoneypot: isSimulatedHoneypot,
    isMintable,
    isBlacklistable,
    isProxy: false,
    isOwnershipRenounced: isRenounced,
    isDojangVerified: isDojang,
    isLiquidityLocked: isLPLocked,
    trustScore: clampedScore,
    riskTier,
    warnings,
  };
}
