import { useState, useEffect, useCallback } from 'react';
import {
  createPublicClient,
  http,
  erc20Abi,
  formatUnits,
  parseAbi,
  type Address,
  type EIP1193Provider,
} from 'viem';
import { giwaSepolia, GIWA_STANDARD_RPC } from '../chains';
import {
  GIWA_POOL_WETH_USDC,
  GIWA_POOL_USDC_EURC,
  GIWA_POOL_KRWC_FX,
  USDC_ADDRESS,
  EURC_ADDRESS,
  KRWC_ADDRESS,
  GIWA_WETH,
} from '../contracts';
import indexedPoolsData from '../data/indexed-pools.json';

export interface GiwaPoolData {
  address: Address;
  name: string;
  token0: Address;
  token1: Address;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
  poolType: 'CLAMM' | 'STABLE';
  feeTier: number;
  feePercent: string;
  reserve0: string;
  reserve1: string;
  tvlUsd: number;
  volume24hUsd: number;
  estimatedApy: number;
  currentPrice: string;
  userPosition?: {
    liquidity: string;
    amount0: string;
    amount1: string;
    sharePercent: string;
  };
}

const CL_POOL_ABI = parseAbi([
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)',
  'function tickSpacing() external view returns (int24)',
  'function mint(address recipient, int24 tickLower, int24 tickUpper, uint128 amount, bytes calldata data) external returns (uint256 amount0, uint256 amount1)',
  'function burn(int24 tickLower, int24 tickUpper, uint128 amount) external returns (uint256 amount0, uint256 amount1)',
  'function collect(address recipient, int24 tickLower, int24 tickUpper, uint128 amount0Requested, uint128 amount1Requested) external returns (uint128 amount0, uint128 amount1)',
]);

const STABLE_POOL_ABI = parseAbi([
  'function coins(uint256 i) external view returns (address)',
  'function balances(uint256 i) external view returns (uint256)',
  'function A_precise() external view returns (uint256)',
  'function get_virtual_price() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount) external returns (uint256)',
  'function remove_liquidity(uint256 _amount, uint256[2] memory min_amounts) external returns (uint256[2] memory)',
]);

export function useGiwaPools(_provider?: EIP1193Provider, userAddress?: string) {
  const [pools, setPools] = useState<GiwaPoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const fetchPools = useCallback(async () => {
    setLoading(true);
    const client = createPublicClient({
      chain: giwaSepolia,
      transport: http(GIWA_STANDARD_RPC),
    });

    try {
      const basePools: Array<{
        address: Address;
        name: string;
        token0: Address;
        token1: Address;
        symbol0: string;
        symbol1: string;
        decimals0: number;
        decimals1: number;
        poolType: 'CLAMM' | 'STABLE';
        feeTier: number;
        feePercent: string;
      }> = [
        {
          address: GIWA_POOL_WETH_USDC,
          name: 'WETH / USDC',
          token0: USDC_ADDRESS,
          token1: GIWA_WETH,
          symbol0: 'USDC',
          symbol1: 'WETH',
          decimals0: 6,
          decimals1: 18,
          poolType: 'CLAMM',
          feeTier: 3000,
          feePercent: '0.30%',
        },
        {
          address: GIWA_POOL_USDC_EURC,
          name: 'USDC / EURC',
          token0: USDC_ADDRESS,
          token1: EURC_ADDRESS,
          symbol0: 'USDC',
          symbol1: 'EURC',
          decimals0: 6,
          decimals1: 6,
          poolType: 'STABLE',
          feeTier: 100,
          feePercent: '0.01%',
        },
        {
          address: GIWA_POOL_KRWC_FX,
          name: 'KRWC / USDC',
          token0: KRWC_ADDRESS,
          token1: USDC_ADDRESS,
          symbol0: 'KRWC',
          symbol1: 'USDC',
          decimals0: 18,
          decimals1: 6,
          poolType: 'STABLE',
          feeTier: 100,
          feePercent: '0.01%',
        },
      ];

      const loadedPools: GiwaPoolData[] = [];

      for (const pool of basePools) {
        let r0 = '0';
        let r1 = '0';
        let currentPrice = '1.00';
        let tvlUsd = 0;
        let volume24hUsd = 0;
        let userPos: GiwaPoolData['userPosition'] = undefined;

        try {
          const deployed = await Promise.all([pool.address, pool.token0, pool.token1].map(address => client.getBytecode({ address })));
          if (deployed.some(code => !code || code === '0x')) continue;
          const [bal0, bal1] = await Promise.all([
            client.readContract({
              address: pool.token0,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [pool.address],
            }).catch(() => 0n),
            client.readContract({
              address: pool.token1,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [pool.address],
            }).catch(() => 0n),
          ]);

          r0 = formatUnits(bal0, pool.decimals0);
          r1 = formatUnits(bal1, pool.decimals1);

          if (pool.poolType === 'CLAMM') {
            const slot0 = await client.readContract({
              address: pool.address,
              abi: CL_POOL_ABI,
              functionName: 'slot0',
            });
            const sqrtP = Number(slot0[0]) / 2 ** 96;
            const rawRatio = sqrtP * sqrtP;
            // Adjustment for decimals (USDC 6, WETH 18 => 10^(18-6) = 10^12)
            const ethPriceInUsdc = 1 / (rawRatio / 1e12);
            currentPrice = ethPriceInUsdc > 0 ? ethPriceInUsdc.toFixed(2) : '2600.00';
            tvlUsd = Number(r0) + Number(r1) * (ethPriceInUsdc > 0 ? ethPriceInUsdc : 2600);
          } else if (pool.name === 'KRWC / USDC') {
            currentPrice = '1,385.00';
            tvlUsd = Number(r0) / 1385 + Number(r1);
          } else {
            currentPrice = '1.08'; // 1 EURC ≈ 1.08 USDC
            tvlUsd = Number(r0) + Number(r1) * 1.08;
          }

          // User LP Balance
          if (userAddress) {
            if (pool.poolType === 'STABLE') {
              const [userLp, totalLp] = await Promise.all([
                client.readContract({
                  address: pool.address,
                  abi: STABLE_POOL_ABI,
                  functionName: 'balanceOf',
                  args: [userAddress as Address],
                }).catch(() => 0n),
                client.readContract({
                  address: pool.address,
                  abi: STABLE_POOL_ABI,
                  functionName: 'totalSupply',
                }).catch(() => 0n),
              ]);

              if (totalLp > 0n && userLp > 0n) {
                const shareRatio = Number(userLp) / Number(totalLp);
                userPos = {
                  liquidity: formatUnits(userLp, 18),
                  amount0: (Number(r0) * shareRatio).toFixed(4),
                  amount1: (Number(r1) * shareRatio).toFixed(4),
                  sharePercent: (shareRatio * 100).toFixed(2),
                };
              }
            }
          }
        } catch (err) {
          console.warn(`[useGiwaPools] Warning loading pool ${pool.name}:`, err);
        }

        // Read indexed volume from cache if present
        const indexedKey = pool.address.toLowerCase();
        const indexed = (indexedPoolsData as any)?.pools?.[indexedKey];
        if (indexed) {
          const v0 = Number(formatUnits(BigInt(indexed.volumeToken0 || '0'), pool.decimals0));
          const v1 = Number(formatUnits(BigInt(indexed.volumeToken1 || '0'), pool.decimals1));
          // This cache contains lifetime volumes, not a 24-hour window.
          // Do not advertise cumulative activity as today's volume or yield.
          void v0;
          void v1;
          volume24hUsd = 0;
        }

        const feeRate = pool.feeTier / 1000000;
        const estimatedApy = tvlUsd > 10 ? ((volume24hUsd * feeRate * 365) / tvlUsd) * 100 : 0;

        loadedPools.push({
          ...pool,
          reserve0: Number(r0).toFixed(pool.decimals0 >= 18 ? 4 : 2),
          reserve1: Number(r1).toFixed(pool.decimals1 >= 18 ? 4 : 2),
          tvlUsd,
          volume24hUsd,
          estimatedApy,
          currentPrice,
          userPosition: userPos,
        });
      }

      setPools(loadedPools);
    } catch (err) {
      console.error('[useGiwaPools] Error loading pools:', err);
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools, refreshIndex]);

  const refresh = () => setRefreshIndex((i) => i + 1);

  return {
    pools,
    loading,
    refresh,
  };
}
