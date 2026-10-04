import { type Address } from 'viem';
import {
  USDC_ADDRESS,
} from '../contracts';

export interface RouteHop {
  tokenIn: Address;
  tokenOut: Address;
  symbolIn: string;
  symbolOut: string;
  fee: number; // e.g. 3000 = 0.30%
  isStable: boolean;
  poolType: 'CLAMM' | 'STABLE';
  poolAddress?: Address;
}

export interface SORRoute {
  path: RouteHop[];
  amountIn: string;
  expectedAmountOut: string;
  minimumAmountOut: string;
  priceImpactPercent: number;
  effectiveRate: number;
  hopsCount: number;
  routeLabel: string;
}

// Known spot exchange rates on Giwa Sepolia DEX
const BASE_RATES: Record<string, number> = {
  'ETH:USDC': 3150.0,
  'WETH:USDC': 3150.0,
  'USDC:KRWC': 1400.0,
  'USDC:EURC': 0.92,
  'USDC:USYC': 1.0,
  'EURC:KRWC': 1521.74,
  'ETH:KRWC': 4410000.0,
  'WETH:KRWC': 4410000.0,
};

function getBaseRate(symIn: string, symOut: string): number {
  if (symIn === symOut) return 1.0;
  const directKey = `${symIn}:${symOut}`;
  if (BASE_RATES[directKey]) return BASE_RATES[directKey];

  const inverseKey = `${symOut}:${symIn}`;
  if (BASE_RATES[inverseKey]) return 1.0 / BASE_RATES[inverseKey];

  // USD bridging proxy
  const rateInToUSD = symIn === 'ETH' || symIn === 'WETH' ? 3150.0 : symIn === 'KRWC' ? 1 / 1400 : symIn === 'EURC' ? 1 / 0.92 : 1.0;
  const rateUSDToOut = symOut === 'ETH' || symOut === 'WETH' ? 1 / 3150.0 : symOut === 'KRWC' ? 1400 : symOut === 'EURC' ? 0.92 : 1.0;
  return rateInToUSD * rateUSDToOut;
}

/**
 * Smart Order Router: Find optimal route (direct vs multi-hop)
 */
export function computeSmartOrderRoute(
  tokenInAddress: Address,
  tokenOutAddress: Address,
  symbolIn: string,
  symbolOut: string,
  amountInStr: string,
  slippageTolerancePercent: number = 0.5
): SORRoute {
  const amountInNum = parseFloat(amountInStr) || 0;
  if (amountInNum <= 0) {
    return {
      path: [],
      amountIn: '0',
      expectedAmountOut: '0',
      minimumAmountOut: '0',
      priceImpactPercent: 0,
      effectiveRate: 0,
      hopsCount: 0,
      routeLabel: 'Direct',
    };
  }

  // Case 1: Direct Pair exists (e.g. WETH/USDC or USDC/EURC or USDC/KRWC)
  const isDirectStable = (symbolIn === 'USDC' && (symbolOut === 'EURC' || symbolOut === 'KRWC' || symbolOut === 'USYC')) ||
                         (symbolOut === 'USDC' && (symbolIn === 'EURC' || symbolIn === 'KRWC' || symbolIn === 'USYC'));

  const isDirectCLAMM = (symbolIn === 'ETH' || symbolIn === 'WETH') && symbolOut === 'USDC' ||
                        (symbolOut === 'ETH' || symbolOut === 'WETH') && symbolIn === 'USDC';

  // Case 2: Multi-Hop (e.g. ETH -> USDC -> KRWC or EURC -> USDC -> ETH)
  const needsMultiHop = !isDirectStable && !isDirectCLAMM && (symbolIn !== symbolOut);

  const hops: RouteHop[] = [];
  let totalFeeLoss = 1.0;
  let grossOut: number;

  if (needsMultiHop) {
    // Hop 1: tokenIn -> USDC
    const hop1Rate = getBaseRate(symbolIn, 'USDC');
    const hop1IsStable = symbolIn === 'EURC' || symbolIn === 'KRWC' || symbolIn === 'USYC';
    const hop1Fee = hop1IsStable ? 100 : 3000;
    totalFeeLoss *= (1 - hop1Fee / 1000000);

    hops.push({
      tokenIn: tokenInAddress,
      tokenOut: USDC_ADDRESS,
      symbolIn,
      symbolOut: 'USDC',
      fee: hop1Fee,
      isStable: hop1IsStable,
      poolType: hop1IsStable ? 'STABLE' : 'CLAMM',
    });

    // Hop 2: USDC -> tokenOut
    const hop2Rate = getBaseRate('USDC', symbolOut);
    const hop2IsStable = symbolOut === 'EURC' || symbolOut === 'KRWC' || symbolOut === 'USYC';
    const hop2Fee = hop2IsStable ? 100 : 3000;
    totalFeeLoss *= (1 - hop2Fee / 1000000);

    hops.push({
      tokenIn: USDC_ADDRESS,
      tokenOut: tokenOutAddress,
      symbolIn: 'USDC',
      symbolOut,
      fee: hop2Fee,
      isStable: hop2IsStable,
      poolType: hop2IsStable ? 'STABLE' : 'CLAMM',
    });

    grossOut = amountInNum * hop1Rate * hop2Rate;
  } else {
    // Single Direct Hop
    const directRate = getBaseRate(symbolIn, symbolOut);
    const fee = isDirectStable ? 100 : 3000;
    totalFeeLoss *= (1 - fee / 1000000);

    hops.push({
      tokenIn: tokenInAddress,
      tokenOut: tokenOutAddress,
      symbolIn,
      symbolOut,
      fee,
      isStable: isDirectStable,
      poolType: isDirectStable ? 'STABLE' : 'CLAMM',
    });

    grossOut = amountInNum * directRate;
  }

  const netOut = grossOut * totalFeeLoss;
  const slippageFactor = 1 - (slippageTolerancePercent / 100);
  const minOut = netOut * slippageFactor;

  // Price impact calculation based on trade size
  const priceImpact = Math.min(0.01 + (amountInNum > 10 ? 0.08 : 0.01), 2.5);

  const routeLabel = hops.map((h) => `${h.symbolIn} (${h.poolType})`).concat(symbolOut).join(' ➔ ');

  return {
    path: hops,
    amountIn: amountInStr,
    expectedAmountOut: netOut.toLocaleString(undefined, { maximumFractionDigits: symbolOut === 'KRWC' ? 0 : 6 }),
    minimumAmountOut: minOut.toLocaleString(undefined, { maximumFractionDigits: symbolOut === 'KRWC' ? 0 : 6 }),
    priceImpactPercent: Number(priceImpact.toFixed(3)),
    effectiveRate: grossOut > 0 ? netOut / amountInNum : 0,
    hopsCount: hops.length,
    routeLabel,
  };
}
