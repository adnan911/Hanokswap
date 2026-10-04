import type { Address } from 'viem';
import {
  GIWA_ALM_VAULT_WETH_USDC,
  GIWA_ALM_VAULT_KRWC_USDC,
  GIWA_WETH,
  USDC_ADDRESS,
  KRWC_ADDRESS,
} from '../contracts';

export interface ALMVaultData {
  id: string;
  name: string;
  symbol: string;
  address: Address;
  token0: { symbol: string; address: Address; icon: string; decimals: number };
  token1: { symbol: string; address: Address; icon: string; decimals: number };
  strategy: 'AUTOMATED_CONCENTRATED' | 'STABLE_COMPOUNDER';
  tvlUSD: number;
  totalApyPct: number;
  feeApyPct: number;
  farmAprPct: number;
  userShares?: string;
  userValueUSD?: number;
  rangeStatus: 'IN_RANGE' | 'OUT_OF_RANGE';
  rebalanceCount: number;
  lastCompound: string;
}

export const DEFAULT_ALM_VAULTS: ALMVaultData[] = [
  {
    id: 'vault-weth-usdc',
    name: 'WETH / USDC Dynamic Auto-Vault',
    symbol: 'hnk-vWETH-USDC',
    address: GIWA_ALM_VAULT_WETH_USDC,
    token0: { symbol: 'WETH', address: GIWA_WETH, icon: '⚡', decimals: 18 },
    token1: { symbol: 'USDC', address: USDC_ADDRESS, icon: '💵', decimals: 6 },
    strategy: 'AUTOMATED_CONCENTRATED',
    tvlUSD: 2450000,
    totalApyPct: 38.4,
    feeApyPct: 22.1,
    farmAprPct: 16.3,
    rangeStatus: 'IN_RANGE',
    rebalanceCount: 142,
    lastCompound: '2 mins ago',
  },
  {
    id: 'vault-krwc-usdc',
    name: 'KRWC / USDC Korean Won FX Yield Vault',
    symbol: 'hnk-vKRWC-USDC',
    address: GIWA_ALM_VAULT_KRWC_USDC,
    token0: { symbol: 'KRWC', address: KRWC_ADDRESS, icon: '₩', decimals: 6 },
    token1: { symbol: 'USDC', address: USDC_ADDRESS, icon: '💵', decimals: 6 },
    strategy: 'STABLE_COMPOUNDER',
    tvlUSD: 5120000,
    totalApyPct: 24.8,
    feeApyPct: 14.5,
    farmAprPct: 10.3,
    rangeStatus: 'IN_RANGE',
    rebalanceCount: 89,
    lastCompound: '5 mins ago',
  },
];

export function getALMVaults(): ALMVaultData[] {
  try {
    const raw = localStorage.getItem('hanok_alm_vaults');
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_ALM_VAULTS;
}

export function saveALMVaultDeposit(vaultId: string, sharesAdded: string, valueUSD: number) {
  const vaults = getALMVaults();
  const match = vaults.find((v) => v.id === vaultId);
  if (match) {
    const currentShares = parseFloat(match.userShares || '0');
    match.userShares = (currentShares + parseFloat(sharesAdded)).toFixed(4);
    match.userValueUSD = (match.userValueUSD || 0) + valueUSD;
    match.tvlUSD += valueUSD;
    localStorage.setItem('hanok_alm_vaults', JSON.stringify(vaults));
  }
}
