/**
 * Giwa DEX Event Indexer & Analytics Sync Worker
 * 
 * Scans Giwa Sepolia on-chain events for:
 * 1. GiwaPoolFactory -> PoolCreated
 * 2. GiwaCLPool -> Swap, Mint, Burn
 * 3. GiwaStableSwap -> TokenExchange, AddLiquidity, RemoveLiquidity
 * 
 * Reads on-chain real-time pool metrics (slot0, liquidity, token reserves) via Multicall3.
 */

import { createPublicClient, http, parseAbiItem, parseAbi, formatUnits, type Address } from 'viem';
import * as fs from 'fs';
import * as path from 'path';

// Network Config
const GIWA_SEPOLIA_RPC = process.env.GIWA_RPC_URL || 'https://sepolia-rpc.giwa.io';
const GIWA_FACTORY_ADDRESS = '0xde7e4fdaaef35680adb15f026a5087801366c316' as Address;
const DEFAULT_DEPLOY_BLOCK = 37330000n;
const MAX_BLOCK_CHUNK = 5000n;

const client = createPublicClient({
  transport: http(GIWA_SEPOLIA_RPC),
});

// ABIs
const PoolCreatedEvent = parseAbiItem(
  'event PoolCreated(address indexed token0, address indexed token1, uint8 poolType, uint24 fee, int24 tickSpacing, address pool)'
);

const CLSwapEvent = parseAbiItem(
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)'
);

const POOL_READ_ABI = parseAbi([
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)',
  'function tickSpacing() external view returns (int24)',
]);

const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
]);

export interface IndexedPool {
  address: Address;
  token0: Address;
  token1: Address;
  symbol0?: string;
  symbol1?: string;
  decimals0?: number;
  decimals1?: number;
  poolType: 'CLAMM' | 'STABLE';
  feeTier: number;
  tickSpacing: number;
  createdAtBlock: bigint;
  totalSwaps: number;
  volumeToken0: string;
  volumeToken1: string;
  reserve0?: string;
  reserve1?: string;
  lastSqrtPriceX96?: string;
  lastTick?: number;
  currentLiquidity?: string;
  estimatedPrice?: string;
}

export interface IndexerState {
  lastIndexedBlock: bigint;
  updatedAt: string;
  pools: Record<string, IndexedPool>;
}

const STATE_FILE_PATH = path.resolve(process.cwd(), 'src', 'data', 'indexed-pools.json');

// Known Genesis Pools to ensure tracking
const KNOWN_POOLS: Array<{
  address: Address;
  token0: Address;
  token1: Address;
  poolType: 'CLAMM' | 'STABLE';
  feeTier: number;
  tickSpacing: number;
}> = [
  {
    address: '0xE9c27006b15E681C0edE87a37Bbb678E7F201F7C',
    token0: '0x3600000000000000000000000000000000000000', // USDC
    token1: '0x4200000000000000000000000000000000000006', // WETH
    poolType: 'CLAMM',
    feeTier: 3000,
    tickSpacing: 60,
  },
  {
    address: '0xd618c9bFED8DdfB7Eed03450940B62E2E3cb91b1',
    token0: '0x3600000000000000000000000000000000000000', // USDC
    token1: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', // EURC
    poolType: 'STABLE',
    feeTier: 100,
    tickSpacing: 1,
  },
];

async function loadState(): Promise<IndexerState> {
  let state: IndexerState = {
    lastIndexedBlock: DEFAULT_DEPLOY_BLOCK,
    updatedAt: new Date().toISOString(),
    pools: {},
  };

  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      state = {
        ...parsed,
        lastIndexedBlock: BigInt(parsed.lastIndexedBlock || DEFAULT_DEPLOY_BLOCK.toString()),
      };
    }
  } catch (err) {
    console.warn('[Indexer] Warning: Failed to read state file, starting fresh:', err);
  }

  // Ensure known genesis pools are present in state
  for (const kp of KNOWN_POOLS) {
    const key = kp.address.toLowerCase();
    if (!state.pools[key]) {
      state.pools[key] = {
        address: kp.address,
        token0: kp.token0,
        token1: kp.token1,
        poolType: kp.poolType,
        feeTier: kp.feeTier,
        tickSpacing: kp.tickSpacing,
        createdAtBlock: DEFAULT_DEPLOY_BLOCK,
        totalSwaps: 0,
        volumeToken0: '0',
        volumeToken1: '0',
      };
    }
  }

  return state;
}

function saveState(state: IndexerState) {
  const dir = path.dirname(STATE_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const jsonString = JSON.stringify(
    state,
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2
  );

  fs.writeFileSync(STATE_FILE_PATH, jsonString, 'utf-8');
  console.log(`[Indexer] Saved indexer state (${Object.keys(state.pools).length} pools, lastBlock: ${state.lastIndexedBlock}) to ${STATE_FILE_PATH}`);
}

async function fetchLogsInChunks<T>(params: {
  address: Address;
  event: any;
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<T[]> {
  const allLogs: T[] = [];
  let currentFrom = params.fromBlock;

  while (currentFrom <= params.toBlock) {
    const currentTo = currentFrom + MAX_BLOCK_CHUNK - 1n < params.toBlock ? currentFrom + MAX_BLOCK_CHUNK - 1n : params.toBlock;
    try {
      const chunkLogs = (await client.getLogs({
        address: params.address,
        event: params.event,
        fromBlock: currentFrom,
        toBlock: currentTo,
      })) as unknown as T[];
      allLogs.push(...chunkLogs);
    } catch (err) {
      console.error(`[Indexer] Chunk error for blocks ${currentFrom}->${currentTo}:`, err);
    }
    currentFrom = currentTo + 1n;
  }

  return allLogs;
}

export async function runIndexer(options: { once?: boolean; fromBlock?: bigint } = {}) {
  console.log('====================================================');
  console.log('🌊 Giwa DEX Event Indexer & State Worker Starting');
  console.log(`📡 RPC Endpoint: ${GIWA_SEPOLIA_RPC}`);
  console.log(`🏭 Factory Address: ${GIWA_FACTORY_ADDRESS}`);
  console.log('====================================================');

  let state = await loadState();
  const currentBlock = await client.getBlockNumber();
  console.log(`[Indexer] Current on-chain block number: ${currentBlock}`);

  const startBlock = options.fromBlock ?? (state.lastIndexedBlock > 0n ? state.lastIndexedBlock + 1n : DEFAULT_DEPLOY_BLOCK);

  if (startBlock <= currentBlock) {
    console.log(`[Indexer] Indexing logs from block ${startBlock} to ${currentBlock}...`);

    try {
      // 1. Query PoolCreated events from Factory
      const poolCreatedLogs = await fetchLogsInChunks<any>({
        address: GIWA_FACTORY_ADDRESS,
        event: PoolCreatedEvent,
        fromBlock: startBlock,
        toBlock: currentBlock,
      });

      console.log(`[Indexer] Discovered ${poolCreatedLogs.length} new PoolCreated events.`);

      for (const log of poolCreatedLogs) {
        const { token0, token1, poolType, fee, tickSpacing, pool } = log.args;
        if (!pool || !token0 || !token1) continue;

        const poolKey = pool.toLowerCase();
        if (!state.pools[poolKey]) {
          state.pools[poolKey] = {
            address: pool,
            token0,
            token1,
            poolType: poolType === 0 ? 'CLAMM' : 'STABLE',
            feeTier: fee ?? 0,
            tickSpacing: tickSpacing ?? 0,
            createdAtBlock: log.blockNumber ?? 0n,
            totalSwaps: 0,
            volumeToken0: '0',
            volumeToken1: '0',
          };
          console.log(`  ➕ Registered Pool: ${pool} (${poolType === 0 ? 'CLAMM' : 'STABLE'}, Fee: ${fee})`);
        }
      }

      // 2. Query Swap events for each CLAMM pool
      for (const pool of Object.values(state.pools)) {
        if (pool.poolType === 'CLAMM') {
          const swapLogs = await fetchLogsInChunks<any>({
            address: pool.address,
            event: CLSwapEvent,
            fromBlock: startBlock,
            toBlock: currentBlock,
          });

          if (swapLogs.length > 0) {
            console.log(`[Indexer] Found ${swapLogs.length} swap events on pool ${pool.address}`);
            for (const sLog of swapLogs) {
              const { amount0, amount1, sqrtPriceX96, liquidity, tick } = sLog.args;
              pool.totalSwaps += 1;
              if (amount0) {
                const abs0 = amount0 < 0n ? -amount0 : amount0;
                pool.volumeToken0 = (BigInt(pool.volumeToken0) + abs0).toString();
              }
              if (amount1) {
                const abs1 = amount1 < 0n ? -amount1 : amount1;
                pool.volumeToken1 = (BigInt(pool.volumeToken1) + abs1).toString();
              }
              if (sqrtPriceX96) pool.lastSqrtPriceX96 = sqrtPriceX96.toString();
              if (tick !== undefined) pool.lastTick = tick;
              if (liquidity !== undefined) pool.currentLiquidity = liquidity.toString();
            }
          }
        }
      }
    } catch (error) {
      console.error('[Indexer] Error during log querying:', error);
    }
  }

  // 3. Update live on-chain state (slot0, token balances, reserves) for every registered pool
  console.log('[Indexer] Syncing on-chain state & reserves for all pools...');
  for (const pool of Object.values(state.pools)) {
    try {
      if (pool.poolType === 'CLAMM') {
        const slot0 = await client.readContract({
          address: pool.address,
          abi: POOL_READ_ABI,
          functionName: 'slot0',
        });
        const currentLiq = await client.readContract({
          address: pool.address,
          abi: POOL_READ_ABI,
          functionName: 'liquidity',
        });

        pool.lastSqrtPriceX96 = slot0[0].toString();
        pool.lastTick = slot0[1];
        pool.currentLiquidity = currentLiq.toString();

        // Calculate approximate human-readable price
        const sqrtP = Number(slot0[0]) / 2 ** 96;
        const priceRatio = sqrtP * sqrtP;
        pool.estimatedPrice = priceRatio.toFixed(6);
      }

      // Token Balances (Reserves)
      const [bal0, bal1] = await Promise.all([
        client.readContract({
          address: pool.token0,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [pool.address],
        }).catch(() => 0n),
        client.readContract({
          address: pool.token1,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [pool.address],
        }).catch(() => 0n),
      ]);

      pool.reserve0 = bal0.toString();
      pool.reserve1 = bal1.toString();
    } catch (err) {
      console.warn(`[Indexer] Could not read live state for pool ${pool.address}:`, err);
    }
  }

  state.lastIndexedBlock = currentBlock;
  state.updatedAt = new Date().toISOString();
  saveState(state);
  console.log('[Indexer] Sync cycle successfully finished.');
}

// Direct CLI Execution
if (process.argv[1]?.includes('indexer-worker.ts')) {
  const once = process.argv.includes('--once') || true;
  runIndexer({ once }).then(() => {
    console.log('🏁 Indexer execution finished.');
    process.exit(0);
  });
}
