import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeFunctionData, encodeFunctionData, encodeEventTopics, encodeAbiParameters, decodeEventLog, type EIP1193Provider } from 'viem';
import { buildSwapParams, minimumSwapOutput, SWAP_ROUTER_ABI } from '../src/lib/swapExecution';
import { computeSmartOrderRoute } from '../src/lib/sor';
import { signPermit2Approval } from '../src/lib/permit2';
import { waitForSuccess } from '../src/txHelpers';
import { GIWA_WETH, USDC_ADDRESS, EURC_ADDRESS, GIWA_L1_STANDARD_BRIDGE, GIWA_OPTIMISM_PORTAL } from '../src/contracts';
import { PoolCreatedEvent, fetchLogsInChunks } from '../scripts/indexer-worker';

test('native input is wrapped and swap calldata contains the full route', () => {
  const route = computeSmartOrderRoute('0x0000000000000000000000000000000000000000', EURC_ADDRESS, 'ETH', 'EURC', '0.1');
  const params = buildSwapParams(route, GIWA_WETH, 18, 123456n);
  assert.equal(params.hops[0].tokenIn, GIWA_WETH);
  assert.equal(params.hops[0].tokenOut, USDC_ADDRESS);
  assert.equal(params.hops[1].tokenOut, EURC_ADDRESS);
  assert.equal(params.amountIn, 100000000000000000n);
  const data = encodeFunctionData({ abi: SWAP_ROUTER_ABI, functionName: 'exactInputMultiHop', args: [params] });
  assert.ok(data.length > 10);
  const decoded = decodeFunctionData({ abi: SWAP_ROUTER_ABI, data });
  assert.equal(decoded.functionName, 'exactInputMultiHop');
  assert.equal(decoded.args?.[0].amountIn, params.amountIn);
});
test('slippage uses integer arithmetic and rejects invalid values', () => {
  assert.equal(minimumSwapOutput(1000000n, 0.5), 995000n);
  assert.equal(minimumSwapOutput(1n, 50), 1n);
  assert.throws(() => minimumSwapOutput(0n, 0.5));
  assert.throws(() => minimumSwapOutput(10n, -1));
  assert.throws(() => minimumSwapOutput(10n, NaN));
});
test('invalid amounts and same-token routes cannot execute', () => {
  const route = computeSmartOrderRoute(GIWA_WETH, GIWA_WETH, 'WETH', 'WETH', '1');
  assert.throws(() => buildSwapParams(route, GIWA_WETH, 18, 1n), /different assets/);
  assert.throws(() => buildSwapParams({ ...route, amountIn: '-1' }, GIWA_WETH, 18, 1n), /positive/);
});
test('wallet signature rejection propagates without mock authorization', async () => {
  const rejection = new Error('User rejected signature');
  const provider = { request: async () => { throw rejection; } } as EIP1193Provider;
  await assert.rejects(signPermit2Approval(provider, GIWA_WETH, USDC_ADDRESS, 1n), error => error === rejection);
});
test('a reverted transaction cannot produce a successful confirmation', async () => {
  await assert.rejects(waitForSuccess({ waitForTransactionReceipt: async () => ({ status: 'reverted' } as any) }, '0x01'), /reverted/);
});
test('bridge and portal addresses agree with official GIWA chain configuration', () => {
  assert.equal(GIWA_L1_STANDARD_BRIDGE, '0x77b2ffc0F57598cAe1DB76cb398059cF5d10A7E7');
  assert.equal(GIWA_OPTIMISM_PORTAL, '0x956962C34687A954e611A83619ABaA37Ce6bC78A');
});
test('indexer decodes the actual factory event including indexed fee and stable flag', () => {
  const topics = encodeEventTopics({ abi: [PoolCreatedEvent], eventName: 'PoolCreated', args: { token0: USDC_ADDRESS, token1: EURC_ADDRESS, fee: 100 } });
  const data = encodeAbiParameters([{ type: 'int24' }, { type: 'bool' }, { type: 'address' }], [1, true, GIWA_WETH]);
  const event = decodeEventLog({ abi: [PoolCreatedEvent], topics, data });
  assert.equal(event.args.isStable, true);
  assert.equal(event.args.fee, 100);
});
test('indexer aborts on failed chunks so its caller cannot checkpoint lost events', async () => {
  let calls = 0;
  await assert.rejects(fetchLogsInChunks({ address: GIWA_WETH, event: PoolCreatedEvent, fromBlock: 1n, toBlock: 12000n }, async () => {
    if (++calls === 2) throw new Error('RPC unavailable');
    return [];
  }), /RPC unavailable/);
  assert.equal(calls, 2);
});
