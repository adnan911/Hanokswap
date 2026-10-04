import type { Address } from 'viem';
import {
  GIWA_POOL_WETH_USDC,
  GIWA_POOL_KRWC_FX,
} from '../contracts';

export interface LiquidityLockRecord {
  lockId: string;
  lpTokenAddress: Address;
  poolName: string;
  ownerAddress: Address;
  amountLP: string;
  valueUSD: number;
  unlockTimestamp: number;
  isBurntPermanently: boolean;
  isWithdrawn: boolean;
  projectName: string;
  createdAt: number;
}

export const DEFAULT_LOCKS: LiquidityLockRecord[] = [
  {
    lockId: 'lock-001',
    lpTokenAddress: GIWA_POOL_WETH_USDC,
    poolName: 'WETH / USDC Core Pool',
    ownerAddress: '0x89C10000000000000000000000000000000000AA' as Address,
    amountLP: '1500.00',
    valueUSD: 450000,
    unlockTimestamp: Date.now() + 86400000 * 365, // 1 year
    isBurntPermanently: false,
    isWithdrawn: false,
    projectName: 'Hanokswap Core DEX',
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    lockId: 'lock-002',
    lpTokenAddress: GIWA_POOL_KRWC_FX,
    poolName: 'KRWC / USDC Deep FX Pool',
    ownerAddress: '0x000000000000000000000000000000000000dEaD' as Address,
    amountLP: '2800.00',
    valueUSD: 840000,
    unlockTimestamp: type_max_timestamp(),
    isBurntPermanently: true,
    isWithdrawn: false,
    projectName: 'Dunamu Official FX Treasury',
    createdAt: Date.now() - 86400000 * 45,
  },
];

function type_max_timestamp(): number {
  return 253402300799000; // Far future (Year 9999)
}

let inMemoryLocks: LiquidityLockRecord[] = [...DEFAULT_LOCKS];

export function getLiquidityLocks(): LiquidityLockRecord[] {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('hanok_liquidity_locks');
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return inMemoryLocks;
}

export function saveNewLiquidityLock(record: LiquidityLockRecord) {
  const list = getLiquidityLocks();
  list.unshift(record);
  inMemoryLocks = list;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('hanok_liquidity_locks', JSON.stringify(list));
    } catch {}
  }
}

