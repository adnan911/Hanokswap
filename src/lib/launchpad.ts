import type { Address } from 'viem';

export interface FairLaunchToken {
  id: string;
  tokenAddress: Address;
  name: string;
  symbol: string;
  creator: Address;
  creatorUpId?: string;
  description: string;
  icon: string;
  ethRaised: number;
  graduationTargetETH: number; // 20 ETH
  tokensSold: number;
  maxCurveSupply: number;      // 800M
  marketCapUSD: number;
  currentPriceUSD: number;
  priceChange24hPct: number;
  holdersCount: number;
  isGraduated: boolean;
  createdAt: number;
  isDojangVerified: boolean;
}

export const DEFAULT_LAUNCHPAD_TOKENS: FairLaunchToken[] = [
  {
    id: 'tok-hanok-cat',
    tokenAddress: '0x89A1000000000000000000000000000000000001' as Address,
    name: 'Hanok Cat',
    symbol: 'HCAT',
    creator: '0x89C10000000000000000000000000000000000AA' as Address,
    creatorUpId: 'hanok.up.id',
    description: 'The first community mascot of Dunamu Giwa Chain, roaming the traditional Hanok rooftops.',
    icon: '🐱',
    ethRaised: 14.8,
    graduationTargetETH: 20.0,
    tokensSold: 592000000,
    maxCurveSupply: 800000000,
    marketCapUSD: 46620,
    currentPriceUSD: 0.0000582,
    priceChange24hPct: +42.5,
    holdersCount: 384,
    isGraduated: false,
    createdAt: Date.now() - 86400000 * 2,
    isDojangVerified: true,
  },
  {
    id: 'tok-giwa-ninja',
    tokenAddress: '0x89A1000000000000000000000000000000000002' as Address,
    name: 'Giwa Ninja',
    symbol: 'NINJA',
    creator: '0x3a4f89d10e8bc12e457f9208a3d4f19b22a6c8e3' as Address,
    creatorUpId: 'ninja.up.id',
    description: 'Sub-second speed token taking full advantage of 0.2s Flashblocks.',
    icon: '🥷',
    ethRaised: 20.0,
    graduationTargetETH: 20.0,
    tokensSold: 800000000,
    maxCurveSupply: 800000000,
    marketCapUSD: 63000,
    currentPriceUSD: 0.0000787,
    priceChange24hPct: +128.4,
    holdersCount: 1120,
    isGraduated: true,
    createdAt: Date.now() - 86400000 * 5,
    isDojangVerified: true,
  },
  {
    id: 'tok-kimchi-pepe',
    tokenAddress: '0x89A1000000000000000000000000000000000003' as Address,
    name: 'Kimchi Pepe',
    symbol: 'KPEPE',
    creator: '0x7b2e1a90c4d3f8e5b6a7c8d9e0f1a2b3c4d5e6f7' as Address,
    description: 'Fermented spicy meme coin native to South Korea and Upbit traders.',
    icon: '🥬',
    ethRaised: 6.2,
    graduationTargetETH: 20.0,
    tokensSold: 248000000,
    maxCurveSupply: 800000000,
    marketCapUSD: 19530,
    currentPriceUSD: 0.0000244,
    priceChange24hPct: +18.2,
    holdersCount: 195,
    isGraduated: false,
    createdAt: Date.now() - 86400000 * 1,
    isDojangVerified: false,
  },
];

let inMemoryTokens: FairLaunchToken[] = [...DEFAULT_LAUNCHPAD_TOKENS];

export function getLaunchpadTokens(): FairLaunchToken[] {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('hanok_launchpad_tokens');
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return inMemoryTokens;
}

export function saveNewFairLaunchToken(token: FairLaunchToken) {
  const list = getLaunchpadTokens();
  list.unshift(token);
  inMemoryTokens = list;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('hanok_launchpad_tokens', JSON.stringify(list));
    } catch {}
  }
}

export function buyBondingCurveToken(tokenId: string, ethAmount: number): { tokensReceived: number; isGraduated: boolean } {
  const list = getLaunchpadTokens();
  const tok = list.find((t) => t.id === tokenId);
  if (!tok || tok.isGraduated) return { tokensReceived: 0, isGraduated: true };

  const tokensReceived = Math.floor((ethAmount / 20.0) * 800000000);
  tok.ethRaised += ethAmount;
  tok.tokensSold += tokensReceived;
  tok.holdersCount += 1;
  tok.marketCapUSD = tok.ethRaised * 3150;
  tok.currentPriceUSD = tok.marketCapUSD / 1000000000;

  if (tok.ethRaised >= tok.graduationTargetETH || tok.tokensSold >= tok.maxCurveSupply) {
    tok.isGraduated = true;
  }

  inMemoryTokens = list;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('hanok_launchpad_tokens', JSON.stringify(list));
    } catch {}
  }
  return { tokensReceived, isGraduated: tok.isGraduated };
}

