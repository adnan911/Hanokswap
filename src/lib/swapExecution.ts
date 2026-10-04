import { parseAbi, parseUnits, type Address } from 'viem';
import { GIWA_WETH } from '../contracts';
import type { SORRoute } from './sor';

export const SWAP_ROUTER_ABI = parseAbi([
  'function exactInputMultiHop(((address tokenIn,address tokenOut,uint24 fee,bool isStable,uint160 sqrtPriceLimitX96)[] hops,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum) params) payable returns (uint256 amountOut)',
]);

export function buildSwapParams(route: SORRoute, recipient: Address, decimalsIn: number, deadline: bigint) {
  const amountIn = parseUnits(route.amountIn, decimalsIn);
  if (amountIn <= 0n || route.path.length === 0) throw new Error('Enter a positive swap amount.');
  const hops = route.path.map(hop => ({
    tokenIn: hop.symbolIn === 'ETH' ? GIWA_WETH : hop.tokenIn,
    tokenOut: hop.symbolOut === 'ETH' ? GIWA_WETH : hop.tokenOut,
    fee: hop.fee,
    isStable: hop.isStable,
    sqrtPriceLimitX96: 0n,
  }));
  for (let i = 0; i < hops.length; i++) {
    if (hops[i].tokenIn.toLowerCase() === hops[i].tokenOut.toLowerCase()) throw new Error('Choose two different assets.');
    if (i > 0 && hops[i - 1].tokenOut.toLowerCase() !== hops[i].tokenIn.toLowerCase()) throw new Error('Invalid swap route.');
  }
  return { hops, recipient, deadline, amountIn, amountOutMinimum: 1n };
}

export function minimumSwapOutput(quotedOutput: bigint, slippagePercent: number): bigint {
  if (quotedOutput <= 0n) throw new Error('No liquidity available for this swap.');
  if (!Number.isFinite(slippagePercent) || slippagePercent < 0 || slippagePercent > 50) throw new Error('Slippage must be between 0% and 50%.');
  const slippageBps = BigInt(Math.round(slippagePercent * 100));
  const minimum = quotedOutput * (10_000n - slippageBps) / 10_000n;
  return minimum > 0n ? minimum : 1n;
}
