export interface PositionPnLMetrics {
  positionId: string;
  poolName: string;
  token0Symbol: string;
  token1Symbol: string;
  entryPrice: number;
  currentPrice: number;
  initialDepositUSD: number;
  currentValueUSD: number;
  uncollectedFeesUSD: number;
  hodlValueUSD: number;
  impermanentLossPct: number;
  impermanentLossUSD: number;
  netPnlUSD: number;
  netRoiPct: number;
  aprPercent: number;
  isALMVault: boolean;
  vaultStrategy?: 'WIDE' | 'CONCENTRATED' | 'BALANCED';
}

export interface PortfolioAggregateSummary {
  totalDepositedUSD: number;
  totalCurrentValueUSD: number;
  totalUncollectedFeesUSD: number;
  totalHodlValueUSD: number;
  totalImpermanentLossUSD: number;
  netPnlUSD: number;
  netRoiPct: number;
  totalDepositedKRW: number;
  totalCurrentValueKRW: number;
  netPnlKRW: number;
}

/**
 * Computes exact Impermanent Loss percentage:
 * IL = 2 * sqrt(k) / (1 + k) - 1, where k = P_current / P_entry
 */
export function calculateImpermanentLoss(entryPrice: number, currentPrice: number): { ilPct: number; multiplier: number } {
  if (entryPrice <= 0 || currentPrice <= 0) return { ilPct: 0, multiplier: 1 };
  const k = currentPrice / entryPrice;
  const multiplier = (2 * Math.sqrt(k)) / (1 + k);
  const ilPct = (multiplier - 1) * 100;
  return { ilPct, multiplier };
}

export const MOCK_USER_POSITIONS: PositionPnLMetrics[] = [
  {
    positionId: 'pos-weth-usdc-01',
    poolName: 'WETH / USDC Concentrated Vault',
    token0Symbol: 'WETH',
    token1Symbol: 'USDC',
    entryPrice: 2850.0,
    currentPrice: 3150.0,
    initialDepositUSD: 10000.0,
    currentValueUSD: 10488.0,
    uncollectedFeesUSD: 384.5,
    hodlValueUSD: 10526.0,
    impermanentLossPct: -0.36,
    impermanentLossUSD: -38.0,
    netPnlUSD: +872.5, // currentValue + fees - initialDeposit
    netRoiPct: +8.72,
    aprPercent: 24.5,
    isALMVault: true,
    vaultStrategy: 'CONCENTRATED',
  },
  {
    positionId: 'pos-krwc-fx-02',
    poolName: 'KRWC / USDC Deep FX Stable Vault',
    token0Symbol: 'KRWC',
    token1Symbol: 'USDC',
    entryPrice: 0.000714,
    currentPrice: 0.000715,
    initialDepositUSD: 25000.0,
    currentValueUSD: 25010.0,
    uncollectedFeesUSD: 612.0,
    hodlValueUSD: 25010.0,
    impermanentLossPct: -0.001,
    impermanentLossUSD: -0.25,
    netPnlUSD: +622.0,
    netRoiPct: +2.48,
    aprPercent: 14.8,
    isALMVault: true,
    vaultStrategy: 'BALANCED',
  },
  {
    positionId: 'pos-hanok-eth-03',
    poolName: 'HANOK / WETH Governance Pool',
    token0Symbol: 'HANOK',
    token1Symbol: 'WETH',
    entryPrice: 0.000062,
    currentPrice: 0.000079,
    initialDepositUSD: 5000.0,
    currentValueUSD: 5580.0,
    uncollectedFeesUSD: 420.0,
    hodlValueUSD: 5685.0,
    impermanentLossPct: -1.85,
    impermanentLossUSD: -105.0,
    netPnlUSD: +1000.0,
    netRoiPct: +20.0,
    aprPercent: 48.6,
    isALMVault: false,
  },
];

export function getPortfolioPositions(_userAddress?: string): PositionPnLMetrics[] {
  return MOCK_USER_POSITIONS;
}

export function getAggregatePortfolioSummary(
  positions: PositionPnLMetrics[] = MOCK_USER_POSITIONS,
  fxRateUSD_KRW: number = 1400
): PortfolioAggregateSummary {
  let totalDepositedUSD = 0;
  let totalCurrentValueUSD = 0;
  let totalUncollectedFeesUSD = 0;
  let totalHodlValueUSD = 0;
  let totalImpermanentLossUSD = 0;

  positions.forEach((p) => {
    totalDepositedUSD += p.initialDepositUSD;
    totalCurrentValueUSD += p.currentValueUSD;
    totalUncollectedFeesUSD += p.uncollectedFeesUSD;
    totalHodlValueUSD += p.hodlValueUSD;
    totalImpermanentLossUSD += p.impermanentLossUSD;
  });

  const netPnlUSD = totalCurrentValueUSD + totalUncollectedFeesUSD - totalDepositedUSD;
  const netRoiPct = totalDepositedUSD > 0 ? (netPnlUSD / totalDepositedUSD) * 100 : 0;

  return {
    totalDepositedUSD,
    totalCurrentValueUSD,
    totalUncollectedFeesUSD,
    totalHodlValueUSD,
    totalImpermanentLossUSD,
    netPnlUSD,
    netRoiPct,
    totalDepositedKRW: totalDepositedUSD * fxRateUSD_KRW,
    totalCurrentValueKRW: totalCurrentValueUSD * fxRateUSD_KRW,
    netPnlKRW: netPnlUSD * fxRateUSD_KRW,
  };
}
