import type { Address } from 'viem';
import {
  GIWA_MULTI_REWARD_FARMING,
  GIWA_POOL_WETH_USDC,
  GIWA_POOL_KRWC_FX,
} from '../contracts';

export interface MultiRewardFarmData {
  id: string;
  name: string;
  lpPair: string;
  lpTokenAddress: Address;
  farmAddress: Address;
  totalStakedUSD: number;
  totalAprPct: number;
  rewardTokens: { symbol: string; icon: string; aprPct: number; ratePerDay: string }[];
  userStakedLP?: string;
  userStakedUSD?: number;
  userBoostMultiplier: number; // 1.0x to 2.5x based on veHANOK
  pendingRewards: { symbol: string; amount: string; valueUSD: number }[];
}

export const DEFAULT_FARMS: MultiRewardFarmData[] = [
  {
    id: 'farm-krwc-usdc',
    name: 'KRWC / USDC Triple-Reward Superfarm',
    lpPair: 'KRWC-USDC',
    lpTokenAddress: GIWA_POOL_KRWC_FX,
    farmAddress: GIWA_MULTI_REWARD_FARMING,
    totalStakedUSD: 4200000,
    totalAprPct: 58.6,
    rewardTokens: [
      { symbol: 'HANOK', icon: '🏛️', aprPct: 32.4, ratePerDay: '12,500 HANOK' },
      { symbol: 'GIWA', icon: '⚡', aprPct: 18.2, ratePerDay: '45,000 GIWA' },
      { symbol: 'KRWC', icon: '₩', aprPct: 8.0, ratePerDay: '5,000,000 KRWC' },
    ],
    userBoostMultiplier: 1.85,
    pendingRewards: [
      { symbol: 'HANOK', amount: '142.50', valueUSD: 178.12 },
      { symbol: 'GIWA', amount: '480.00', valueUSD: 96.00 },
      { symbol: 'KRWC', amount: '125,000', valueUSD: 89.28 },
    ],
  },
  {
    id: 'farm-weth-usdc',
    name: 'WETH / USDC Dual-Reward Core Farm',
    lpPair: 'WETH-USDC',
    lpTokenAddress: GIWA_POOL_WETH_USDC,
    farmAddress: GIWA_MULTI_REWARD_FARMING,
    totalStakedUSD: 6800000,
    totalAprPct: 41.2,
    rewardTokens: [
      { symbol: 'HANOK', icon: '🏛️', aprPct: 28.2, ratePerDay: '18,000 HANOK' },
      { symbol: 'GIWA', icon: '⚡', aprPct: 13.0, ratePerDay: '32,000 GIWA' },
    ],
    userBoostMultiplier: 1.5,
    pendingRewards: [
      { symbol: 'HANOK', amount: '88.20', valueUSD: 110.25 },
      { symbol: 'GIWA', amount: '220.00', valueUSD: 44.00 },
    ],
  },
];

export function getMultiRewardFarms(): MultiRewardFarmData[] {
  try {
    const raw = localStorage.getItem('hanok_farms');
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_FARMS;
}

export function claimAllFarmRewards(farmId: string): number {
  const farms = getMultiRewardFarms();
  const match = farms.find((f) => f.id === farmId);
  if (!match) return 0;
  
  let totalUSD = 0;
  for (const rew of match.pendingRewards) {
    totalUSD += rew.valueUSD;
    rew.amount = '0.00';
    rew.valueUSD = 0;
  }
  localStorage.setItem('hanok_farms', JSON.stringify(farms));
  return totalUSD;
}
