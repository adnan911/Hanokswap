import type { Address } from 'viem';
import {
  GIWA_POOL_WETH_USDC,
  GIWA_POOL_USDC_EURC,
  GIWA_POOL_KRWC_FX,
} from '../contracts';

export interface PoolGauge {
  id: string;
  name: string;
  pairLabel: string;
  poolAddress: Address;
  currentVoteWeightPct: number; // e.g. 42.5%
  userVotedWeightPct: number;   // e.g. 20.0%
  bribesUSD: number;
  weeklyEmissionsHANOK: number;
  estApy: number;
}

export interface UserVeHanokProfile {
  hanokBalance: string;
  lockedAmount: string;
  veHanokBalance: string;
  unlockTimestamp: number;
  lockDurationWeeks: number;
  votingPowerPct: number;
  totalProtocolVeLocked: string;
}

export const DEFAULT_GAUGES: PoolGauge[] = [
  {
    id: 'gauge-krwc-usdc',
    name: 'KRWC / USDC Deep FX Stable Pool',
    pairLabel: 'KRWC-USDC',
    poolAddress: GIWA_POOL_KRWC_FX,
    currentVoteWeightPct: 45.0,
    userVotedWeightPct: 0,
    bribesUSD: 18500,
    weeklyEmissionsHANOK: 112500,
    estApy: 42.5,
  },
  {
    id: 'gauge-weth-usdc',
    name: 'WETH / USDC Concentrated CLAMM',
    pairLabel: 'WETH-USDC',
    poolAddress: GIWA_POOL_WETH_USDC,
    currentVoteWeightPct: 35.0,
    userVotedWeightPct: 0,
    bribesUSD: 14200,
    weeklyEmissionsHANOK: 87500,
    estApy: 38.2,
  },
  {
    id: 'gauge-usdc-eurc',
    name: 'USDC / EURC Foreign Exchange Curve',
    pairLabel: 'USDC-EURC',
    poolAddress: GIWA_POOL_USDC_EURC,
    currentVoteWeightPct: 20.0,
    userVotedWeightPct: 0,
    bribesUSD: 6800,
    weeklyEmissionsHANOK: 50000,
    estApy: 22.0,
  },
];

export function getUserVeHanokProfile(_userAddress?: string): UserVeHanokProfile {
  try {
    const raw = localStorage.getItem('hanok_ve_profile');
    if (raw) return JSON.parse(raw);
  } catch {}

  return {
    hanokBalance: '10000.00',
    lockedAmount: '2500.00',
    veHanokBalance: '2187.50',
    unlockTimestamp: Date.now() + 86400000 * 365 * 2, // 2 years
    lockDurationWeeks: 104,
    votingPowerPct: 0.12,
    totalProtocolVeLocked: '1850000.00',
  };
}

export function saveUserVeHanokLock(amountLocked: string, lockWeeks: number) {
  const profile = getUserVeHanokProfile();
  const amt = parseFloat(amountLocked) || 0;
  const currLocked = parseFloat(profile.lockedAmount) || 0;
  const newLocked = currLocked + amt;

  // veHANOK = amount * (weeks / 208)
  const veAmt = newLocked * (lockWeeks / 208);

  profile.lockedAmount = newLocked.toFixed(2);
  profile.veHanokBalance = veAmt.toFixed(2);
  profile.lockDurationWeeks = lockWeeks;
  profile.unlockTimestamp = Date.now() + lockWeeks * 7 * 86400000;
  profile.hanokBalance = Math.max(0, parseFloat(profile.hanokBalance) - amt).toFixed(2);

  localStorage.setItem('hanok_ve_profile', JSON.stringify(profile));
}

export function getPoolGauges(): PoolGauge[] {
  try {
    const raw = localStorage.getItem('hanok_gauges');
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_GAUGES;
}

export function voteOnGauge(gaugeId: string, weightPct: number) {
  const gauges = getPoolGauges();
  const match = gauges.find((g) => g.id === gaugeId);
  if (match) {
    match.userVotedWeightPct = weightPct;
    localStorage.setItem('hanok_gauges', JSON.stringify(gauges));
  }
}
