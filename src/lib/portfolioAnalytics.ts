import type { GiwaPoolData } from '../hooks/useGiwaPools';

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

/**
 * Derives user's active LP positions from live on-chain GIWA pools
 */
export function derivePositionsFromPools(pools: GiwaPoolData[]): PositionPnLMetrics[] {
  const result: PositionPnLMetrics[] = [];

  for (const p of pools) {
    if (p.userPosition && parseFloat(p.userPosition.liquidity) > 0) {
      const share = parseFloat(p.userPosition.sharePercent || '0') / 100;
      const currentValueUSD = p.tvlUsd * share;
      const estPrice = parseFloat(p.currentPrice) || 1;

      result.push({
        positionId: `pos-${p.address.slice(2, 10)}`,
        poolName: p.name,
        token0Symbol: p.symbol0,
        token1Symbol: p.symbol1,
        entryPrice: estPrice,
        currentPrice: estPrice,
        initialDepositUSD: currentValueUSD,
        currentValueUSD,
        uncollectedFeesUSD: 0,
        hodlValueUSD: currentValueUSD,
        impermanentLossPct: 0,
        impermanentLossUSD: 0,
        netPnlUSD: 0,
        netRoiPct: 0,
        aprPercent: p.estimatedApy || 0,
        isALMVault: false,
      });
    }
  }

  return result;
}

export function getAggregatePortfolioSummary(
  positions: PositionPnLMetrics[] = [],
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
