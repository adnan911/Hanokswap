// Read-only deployment checks. Does not load private keys or submit transactions.
import { createPublicClient, http, parseAbi, type Address } from 'viem';
import { writeFileSync } from 'node:fs';
import { giwaSepolia } from '../src/chains';
import * as contracts from '../src/contracts';

const client = createPublicClient({ chain: giwaSepolia, transport: http('https://sepolia-rpc.giwa.io', { timeout: 5000, retryCount: 0 }) });
const names = ['GIWA_DEX_FACTORY', 'GIWA_DEX_ROUTER', 'GIWA_POOL_WETH_USDC', 'GIWA_POOL_USDC_EURC', 'GIWA_WETH', 'USDC_ADDRESS', 'EURC_ADDRESS', 'KRWC_ADDRESS', 'GIWA_DOJANG_SCROLL', 'GIWA_DCA_STREAMER', 'GIWA_BONDING_CURVE_LAUNCHPAD'];
const records: Array<{ name: string; address: Address; deployed?: boolean; error?: string }> = [];
for (const name of names) {
  const address = (contracts as Record<string, Address>)[name];
  try {
    const code = await client.getBytecode({ address });
    records.push({ name, address, deployed: !!code && code !== '0x' });
  } catch (error) { records.push({ name, address, error: error instanceof Error ? error.message.split('\n')[0] : String(error) }); }
}
const routerReads: Record<string, string> = {};
for (const name of ['factory', 'permit2']) {
  try {
    routerReads[name] = await client.readContract({ address: contracts.GIWA_DEX_ROUTER, abi: parseAbi([`function ${name}() view returns (address)`]), functionName: name });
  } catch (error) { routerReads[name] = error instanceof Error ? error.message.split('\n')[0] : String(error); }
}
const result = { checkedAt: new Date().toISOString(), chainId: await client.getChainId(), records, routerReads };
writeFileSync('.gsd/live-network-audit.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
