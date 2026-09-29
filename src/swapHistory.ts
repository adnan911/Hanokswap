import type { PublicClient } from "viem";

export interface RecentTrade {
  trader: `0x${string}`;
  aToB: boolean;
  amountIn: bigint;
  amountOut: bigint;
  blockNumber: bigint;
  txHash: `0x${string}`;
}

export async function fetchRecentTrades(
  _poolAddress: `0x${string}`,
  _client?: PublicClient
): Promise<RecentTrade[]> {
  return [];
}
