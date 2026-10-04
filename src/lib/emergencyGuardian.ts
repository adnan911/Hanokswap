import type { Address } from 'viem';
import {
  GIWA_POOL_KRWC_FX,
  GIWA_POOL_USDC_EURC,
  GIWA_POOL_WETH_USDC,
} from '../contracts';

export interface GuardianPoolStatus {
  poolAddress: Address;
  poolName: string;
  assetSymbol: string;
  targetPegPrice: number;
  currentPrice: number;
  deviationPct: number;
  isDepegWarning: boolean;            // > 1% deviation
  isCircuitBreakerTriggered: boolean;  // > 3% deviation or severe drain
  isPaused: boolean;
  drainVelocity10mPct: number;        // Liquidity outflow in last 10m
  lastCheckTimestamp: number;
}

export const INITIAL_GUARDIAN_POOLS: GuardianPoolStatus[] = [
  {
    poolAddress: GIWA_POOL_KRWC_FX,
    poolName: 'KRWC / USDC Deep FX Pool',
    assetSymbol: 'KRWC',
    targetPegPrice: 0.00071428, // 1/1400 USD
    currentPrice: 0.00071440,
    deviationPct: +0.02,
    isDepegWarning: false,
    isCircuitBreakerTriggered: false,
    isPaused: false,
    drainVelocity10mPct: 1.2,
    lastCheckTimestamp: Date.now(),
  },
  {
    poolAddress: GIWA_POOL_USDC_EURC,
    poolName: 'USDC / EURC Foreign Exchange Pool',
    assetSymbol: 'EURC',
    targetPegPrice: 1.0850,
    currentPrice: 1.0842,
    deviationPct: -0.07,
    isDepegWarning: false,
    isCircuitBreakerTriggered: false,
    isPaused: false,
    drainVelocity10mPct: 0.8,
    lastCheckTimestamp: Date.now(),
  },
  {
    poolAddress: GIWA_POOL_WETH_USDC,
    poolName: 'WETH / USDC Core Pool',
    assetSymbol: 'WETH',
    targetPegPrice: 3150.0,
    currentPrice: 3148.5,
    deviationPct: -0.05,
    isDepegWarning: false,
    isCircuitBreakerTriggered: false,
    isPaused: false,
    drainVelocity10mPct: 3.5,
    lastCheckTimestamp: Date.now(),
  },
];

const inMemoryGuardianPools: GuardianPoolStatus[] = [...INITIAL_GUARDIAN_POOLS];

export function getGuardianMonitoredPools(): GuardianPoolStatus[] {
  return inMemoryGuardianPools;
}

export function triggerEmergencyPause(poolAddress: string): boolean {
  const pool = inMemoryGuardianPools.find(
    (p) => p.poolAddress.toLowerCase() === poolAddress.toLowerCase()
  );
  if (!pool) return false;
  pool.isPaused = true;
  pool.isCircuitBreakerTriggered = true;
  return true;
}

export function triggerEmergencyUnpause(poolAddress: string): boolean {
  const pool = inMemoryGuardianPools.find(
    (p) => p.poolAddress.toLowerCase() === poolAddress.toLowerCase()
  );
  if (!pool) return false;
  pool.isPaused = false;
  pool.isCircuitBreakerTriggered = false;
  return true;
}

export function simulateDepegEvent(poolAddress: string, priceDropPct: number): GuardianPoolStatus | null {
  const pool = inMemoryGuardianPools.find(
    (p) => p.poolAddress.toLowerCase() === poolAddress.toLowerCase()
  );
  if (!pool) return null;

  pool.currentPrice = pool.targetPegPrice * (1 - priceDropPct / 100);
  pool.deviationPct = -priceDropPct;
  pool.isDepegWarning = priceDropPct >= 1.0;
  if (priceDropPct >= 3.0) {
    pool.isCircuitBreakerTriggered = true;
    pool.isPaused = true; // Auto-pause pool
  }
  pool.lastCheckTimestamp = Date.now();
  return pool;
}
