import type { Address } from 'viem';
import {
  GIWA_POOL_WETH_USDC,
  GIWA_POOL_KRWC_FX,
  GIWA_POOL_BTC_USDC,
  GIWA_POOL_HANOK_ETH,
  GIWA_POOL_GIWA_USDC,
} from '../contracts';

export interface TokenEntity {
  id: Address;
  symbol: string;
  name: string;
  decimals: number;
  tradeVolumeUSD: number;
  totalValueLockedUSD: number;
  isDojangVerified: boolean;
}

export interface PoolStats {
  id: Address;
  name: string;
  token0: TokenEntity;
  token1: TokenEntity;
  feeTierBps: number;
  totalValueLockedUSD: number;
  totalValueLockedKRW: number;
  volume24hUSD: number;
  volume24hKRW: number;
  fees24hUSD: number;
  aprPercent: number;
  isStableswap: boolean;
  isDojangGated: boolean;
  txCount: number;
}

export interface SwapEventRecord {
  id: string;
  transactionHash: string;
  timestamp: number;
  blockNumber: number;
  flashblockIndex: number;
  poolAddress: Address;
  poolName: string;
  sender: Address;
  recipient: Address;
  recipientUpId?: string;
  tokenInSymbol: string;
  tokenOutSymbol: string;
  amountIn: number;
  amountOut: number;
  amountUSD: number;
  amountKRW: number;
  feeUSD: number;
}

export interface MintEventRecord {
  id: string;
  transactionHash: string;
  timestamp: number;
  poolAddress: Address;
  poolName: string;
  owner: Address;
  amount0: number;
  amount1: number;
  amountUSD: number;
  tickLower: number;
  tickUpper: number;
}

export interface BurnEventRecord {
  id: string;
  transactionHash: string;
  timestamp: number;
  poolAddress: Address;
  poolName: string;
  owner: Address;
  amount0: number;
  amount1: number;
  amountUSD: number;
}

export interface CollectEventRecord {
  id: string;
  transactionHash: string;
  timestamp: number;
  poolAddress: Address;
  poolName: string;
  owner: Address;
  fee0: number;
  fee1: number;
  feeUSD: number;
}

export interface FactoryOverview {
  totalValueLockedUSD: number;
  totalValueLockedKRW: number;
  volume24hUSD: number;
  volume24hKRW: number;
  totalFees24hUSD: number;
  totalTransactions24h: number;
  activePoolsCount: number;
  subSecondIndexingLagMs: number;
}

export const MOCK_POOLS_ANALYTICS: Record<string, PoolStats> = {
  [GIWA_POOL_WETH_USDC.toLowerCase()]: {
    id: GIWA_POOL_WETH_USDC,
    name: 'WETH / USDC Core Pool',
    token0: { id: '0x4200000000000000000000000000000000000006' as Address, symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, tradeVolumeUSD: 14250000, totalValueLockedUSD: 4200000, isDojangVerified: true },
    token1: { id: '0x3600000000000000000000000000000000000000' as Address, symbol: 'USDC', name: 'USD Coin', decimals: 6, tradeVolumeUSD: 14250000, totalValueLockedUSD: 4200000, isDojangVerified: true },
    feeTierBps: 5,
    totalValueLockedUSD: 8400000,
    totalValueLockedKRW: 11760000000,
    volume24hUSD: 2450000,
    volume24hKRW: 3430000000,
    fees24hUSD: 12250,
    aprPercent: 24.5,
    isStableswap: false,
    isDojangGated: false,
    txCount: 1420,
  },
  [GIWA_POOL_KRWC_FX.toLowerCase()]: {
    id: GIWA_POOL_KRWC_FX,
    name: 'KRWC / USDC Deep FX Stableswap Pool',
    token0: { id: '0x89C0000000000000000000000000000000000001' as Address, symbol: 'KRWC', name: 'Dunamu KRW Coin', decimals: 18, tradeVolumeUSD: 18900000, totalValueLockedUSD: 6500000, isDojangVerified: true },
    token1: { id: '0x3600000000000000000000000000000000000000' as Address, symbol: 'USDC', name: 'USD Coin', decimals: 6, tradeVolumeUSD: 18900000, totalValueLockedUSD: 6500000, isDojangVerified: true },
    feeTierBps: 1,
    totalValueLockedUSD: 13000000,
    totalValueLockedKRW: 18200000000,
    volume24hUSD: 4890000,
    volume24hKRW: 6846000000,
    fees24hUSD: 4890,
    aprPercent: 14.8,
    isStableswap: true,
    isDojangGated: false,
    txCount: 2840,
  },
  [GIWA_POOL_BTC_USDC.toLowerCase()]: {
    id: GIWA_POOL_BTC_USDC,
    name: 'cirBTC / USDC Pool',
    token0: { id: '0x07865c6e87b9f70255377e024ace6630c1eaa37f' as Address, symbol: 'cirBTC', name: 'Circle Bitcoin', decimals: 8, tradeVolumeUSD: 8900000, totalValueLockedUSD: 5100000, isDojangVerified: true },
    token1: { id: '0x3600000000000000000000000000000000000000' as Address, symbol: 'USDC', name: 'USD Coin', decimals: 6, tradeVolumeUSD: 8900000, totalValueLockedUSD: 5100000, isDojangVerified: true },
    feeTierBps: 5,
    totalValueLockedUSD: 10200000,
    totalValueLockedKRW: 14280000000,
    volume24hUSD: 1980000,
    volume24hKRW: 2772000000,
    fees24hUSD: 9900,
    aprPercent: 18.2,
    isStableswap: false,
    isDojangGated: false,
    txCount: 890,
  },
  [GIWA_POOL_HANOK_ETH.toLowerCase()]: {
    id: GIWA_POOL_HANOK_ETH,
    name: 'HANOK / WETH Governance Pool',
    token0: { id: '0x89C4000000000000000000000000000000000001' as Address, symbol: 'HANOK', name: 'Hanok Governance Token', decimals: 18, tradeVolumeUSD: 3400000, totalValueLockedUSD: 1800000, isDojangVerified: true },
    token1: { id: '0x4200000000000000000000000000000000000006' as Address, symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, tradeVolumeUSD: 3400000, totalValueLockedUSD: 1800000, isDojangVerified: true },
    feeTierBps: 30,
    totalValueLockedUSD: 3600000,
    totalValueLockedKRW: 5040000000,
    volume24hUSD: 850000,
    volume24hKRW: 1190000000,
    fees24hUSD: 2550,
    aprPercent: 48.6,
    isStableswap: false,
    isDojangGated: false,
    txCount: 610,
  },
  [GIWA_POOL_GIWA_USDC.toLowerCase()]: {
    id: GIWA_POOL_GIWA_USDC,
    name: 'GIWA / USDC Dojang Compliance Pool',
    token0: { id: '0x89C0000000000000000000000000000000000003' as Address, symbol: 'GIWA', name: 'Giwa Network Token', decimals: 18, tradeVolumeUSD: 5600000, totalValueLockedUSD: 2400000, isDojangVerified: true },
    token1: { id: '0x3600000000000000000000000000000000000000' as Address, symbol: 'USDC', name: 'USD Coin', decimals: 6, tradeVolumeUSD: 5600000, totalValueLockedUSD: 2400000, isDojangVerified: true },
    feeTierBps: 5,
    totalValueLockedUSD: 4800000,
    totalValueLockedKRW: 6720000000,
    volume24hUSD: 1120000,
    volume24hKRW: 1568000000,
    fees24hUSD: 5600,
    aprPercent: 32.1,
    isStableswap: false,
    isDojangGated: true,
    txCount: 780,
  },
};

export const MOCK_SWAPS: SwapEventRecord[] = [
  {
    id: 'swap-01',
    transactionHash: '0x7a91bf39c28e938f0d829104c8f391a920fba8c91d847192849bca7f918e001a',
    timestamp: Date.now() - 1000 * 12,
    blockNumber: 4892011,
    flashblockIndex: 4,
    poolAddress: GIWA_POOL_WETH_USDC,
    poolName: 'WETH / USDC',
    sender: '0x89C10000000000000000000000000000000000AA' as Address,
    recipient: '0x89C10000000000000000000000000000000000AA' as Address,
    recipientUpId: 'hanok.up.id',
    tokenInSymbol: 'WETH',
    tokenOutSymbol: 'USDC',
    amountIn: 2.5,
    amountOut: 7875.0,
    amountUSD: 7875.0,
    amountKRW: 11025000,
    feeUSD: 3.93,
  },
  {
    id: 'swap-02',
    transactionHash: '0x3f98ba74c91038e819b28471048bc9284710bcae83918274a108cbe839108392',
    timestamp: Date.now() - 1000 * 45,
    blockNumber: 4892009,
    flashblockIndex: 2,
    poolAddress: GIWA_POOL_KRWC_FX,
    poolName: 'KRWC / USDC',
    sender: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address,
    recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address,
    recipientUpId: 'whale.up.id',
    tokenInSymbol: 'USDC',
    tokenOutSymbol: 'KRWC',
    amountIn: 10000.0,
    amountOut: 14000000.0,
    amountUSD: 10000.0,
    amountKRW: 14000000,
    feeUSD: 1.0,
  },
  {
    id: 'swap-03',
    transactionHash: '0x1c8479219bce83910bcae8391083928471048bc9284710bcae83918274a108cb',
    timestamp: Date.now() - 1000 * 95,
    blockNumber: 4892005,
    flashblockIndex: 8,
    poolAddress: GIWA_POOL_HANOK_ETH,
    poolName: 'HANOK / WETH',
    sender: '0x3a4f89d10e8bc12e457f9208a3d4f19b22a6c8e3' as Address,
    recipient: '0x3a4f89d10e8bc12e457f9208a3d4f19b22a6c8e3' as Address,
    recipientUpId: 'trader.up.id',
    tokenInSymbol: 'HANOK',
    tokenOutSymbol: 'WETH',
    amountIn: 12000.0,
    amountOut: 0.95,
    amountUSD: 2992.5,
    amountKRW: 4189500,
    feeUSD: 8.97,
  },
];

export async function fetchProtocolOverview(): Promise<FactoryOverview> {
  let totalTvl = 0;
  let totalVol = 0;
  let totalFees = 0;
  let totalTx = 0;

  Object.values(MOCK_POOLS_ANALYTICS).forEach((p) => {
    totalTvl += p.totalValueLockedUSD;
    totalVol += p.volume24hUSD;
    totalFees += p.fees24hUSD;
    totalTx += p.txCount;
  });

  return {
    totalValueLockedUSD: totalTvl,
    totalValueLockedKRW: totalTvl * 1400,
    volume24hUSD: totalVol,
    volume24hKRW: totalVol * 1400,
    totalFees24hUSD: totalFees,
    totalTransactions24h: totalTx,
    activePoolsCount: Object.keys(MOCK_POOLS_ANALYTICS).length,
    subSecondIndexingLagMs: 180, // 180ms Envio Hypersync response latency
  };
}

export async function fetchPoolAnalytics(poolAddress: string): Promise<PoolStats | null> {
  const clean = poolAddress.toLowerCase();
  return MOCK_POOLS_ANALYTICS[clean] || null;
}

export async function fetchRecentSwaps(limit: number = 20): Promise<SwapEventRecord[]> {
  return MOCK_SWAPS.slice(0, limit);
}

export async function fetchUserPositionHistory(userAddress: string) {
  const clean = userAddress.toLowerCase();
  const userSwaps = MOCK_SWAPS.filter(
    (s) => s.sender.toLowerCase() === clean || s.recipient.toLowerCase() === clean
  );
  return {
    swaps: userSwaps,
    mints: [],
    burns: [],
    collects: [],
  };
}
