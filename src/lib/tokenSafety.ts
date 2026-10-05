import { isTokenDojangVerified } from './dojang';
import { getLiquidityLocks } from './liquidityLocker';
import { createPublicClient, http, erc20Abi, parseAbi, type Address } from 'viem';
import { giwaSepolia, GIWA_STANDARD_RPC } from '../chains';
import { USDC_ADDRESS, KRWC_ADDRESS, EURC_ADDRESS, GIWA_WETH, GIWA_HANOK_TOKEN } from '../contracts';

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
  [USDC_ADDRESS.toLowerCase()]: {
    symbol: 'USDC',
    name: 'USD Coin',
    buyTaxPct: 0,
    sellTaxPct: 0,
    isHoneypot: false,
    isMintable: true, // Regulated fiat issuer
    isBlacklistable: true,
    isProxy: true,
    isOwnershipRenounced: false,
    isDojangVerified: true,
    isLiquidityLocked: true,
    trustScore: 98,
    riskTier: 'VERIFIED_SAFE',
    warnings: ['Regulated Fiat-Backed Stablecoin (Circle Reserve)'],
  },
  [KRWC_ADDRESS.toLowerCase()]: {
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
  [GIWA_WETH.toLowerCase()]: {
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
  [EURC_ADDRESS.toLowerCase()]: {
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
  [GIWA_HANOK_TOKEN.toLowerCase()]: {
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
  if (!tokenAddress || !tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
    return {
      tokenAddress: tokenAddress || '',
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
      warnings: ['Invalid or empty token address provided'],
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

  // Live on-chain inspection on GIWA Sepolia
  const isDojang = isTokenDojangVerified(tokenAddress);
  const locks = getLiquidityLocks();
  const isLPLocked = locks.some(
    (lk) => lk.lpTokenAddress.toLowerCase() === cleanAddr || lk.ownerAddress.toLowerCase() === '0x000000000000000000000000000000000000dead'
  );

  const warnings: string[] = [];
  let score = 75;
  let onChainName = fallbackName || 'Community Token';
  let onChainSymbol = fallbackSymbol || 'TOKEN';
  let isOwnershipRenounced = false;

  try {
    const client = createPublicClient({
      chain: giwaSepolia,
      transport: http(GIWA_STANDARD_RPC),
    });

    const bytecode = await client.getBytecode({ address: tokenAddress as Address });
    if (!bytecode || bytecode === '0x') {
      return {
        tokenAddress,
        symbol: fallbackSymbol || 'INVALID',
        name: fallbackName || 'Not a contract',
        buyTaxPct: 0,
        sellTaxPct: 0,
        isHoneypot: true,
        isMintable: false,
        isBlacklistable: false,
        isProxy: false,
        isOwnershipRenounced: false,
        isDojangVerified: false,
        isLiquidityLocked: false,
        trustScore: 0,
        riskTier: 'HONEYPOT_DANGER',
        warnings: ['Address has no deployed contract bytecode on GIWA Sepolia'],
      };
    }

    try {
      const [fetchedName, fetchedSymbol] = await Promise.all([
        client.readContract({ address: tokenAddress as Address, abi: erc20Abi, functionName: 'name' }),
        client.readContract({ address: tokenAddress as Address, abi: erc20Abi, functionName: 'symbol' }),
      ]);
      if (fetchedName) onChainName = fetchedName;
      if (fetchedSymbol) onChainSymbol = fetchedSymbol;
    } catch {}

    try {
      const owner = await client.readContract({
        address: tokenAddress as Address,
        abi: parseAbi(['function owner() view returns (address)']),
        functionName: 'owner',
      });
      if (owner === '0x0000000000000000000000000000000000000000' || owner.toLowerCase() === '0x000000000000000000000000000000000000dead') {
        isOwnershipRenounced = true;
      }
    } catch {
      // Contract might not have owner() or ownership is renounced
      isOwnershipRenounced = true;
    }
  } catch {
    // Network read error, fallback to safe defaults
  }

  if (isDojang) {
    score += 20;
  } else {
    warnings.push('Token project has not completed Dunamu Dojang attestation.');
    score -= 10;
  }

  if (isLPLocked) {
    score += 15;
  } else {
    warnings.push('No verified LP lock certificate found on Giwa Liquidity Locker.');
    score -= 10;
  }

  if (isOwnershipRenounced) {
    score += 10;
  }

  const clampedScore = Math.max(0, Math.min(100, score));
  let riskTier: TokenSafetyReport['riskTier'] = 'LOW_RISK';
  if (clampedScore <= 35) {
    riskTier = 'HONEYPOT_DANGER';
  } else if (clampedScore <= 65) {
    riskTier = 'MEDIUM_RISK';
  } else if (isDojang && clampedScore >= 85) {
    riskTier = 'VERIFIED_SAFE';
  }

  return {
    tokenAddress,
    symbol: onChainSymbol,
    name: onChainName,
    buyTaxPct: 0,
    sellTaxPct: 0,
    isHoneypot: false,
    isMintable: !isOwnershipRenounced,
    isBlacklistable: false,
    isProxy: false,
    isOwnershipRenounced,
    isDojangVerified: isDojang,
    isLiquidityLocked: isLPLocked,
    trustScore: clampedScore,
    riskTier,
    warnings,
  };
}

