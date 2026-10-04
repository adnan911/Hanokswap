import { type Address } from 'viem';

export type LimitOrderStatus = 'OPEN' | 'FILLED' | 'CANCELLED';

export interface DEXLimitOrder {
  id: string;
  maker: Address;
  tokenInSymbol: string;
  tokenOutSymbol: string;
  tokenInAddress: Address;
  tokenOutAddress: Address;
  amountIn: string;
  targetPriceUSD: number;
  minAmountOut: string;
  createdAt: number;
  expiresAt: number;
  status: LimitOrderStatus;
  isBuy: boolean; // Buy or Sell relative to base token
  txHash?: string;
}

const STORAGE_KEY = 'hanokswap_giwa_limit_orders_v1';

export function getDEXLimitOrders(user?: Address): DEXLimitOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: DEXLimitOrder[] = raw ? JSON.parse(raw) : [];
    if (!user) return all;
    return all.filter((o) => o.maker.toLowerCase() === user.toLowerCase());
  } catch {
    return [];
  }
}

export function saveDEXLimitOrder(order: DEXLimitOrder): void {
  const existing = getDEXLimitOrders();
  const filtered = existing.filter((o) => o.id !== order.id);
  filtered.unshift(order);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  window.dispatchEvent(new CustomEvent('giwa_limit_orders_updated'));
}

export function cancelDEXLimitOrder(orderId: string): void {
  const existing = getDEXLimitOrders();
  const order = existing.find((o) => o.id === orderId);
  if (order) {
    order.status = 'CANCELLED';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent('giwa_limit_orders_updated'));
  }
}

export function fillDEXLimitOrder(orderId: string, txHash?: string): void {
  const existing = getDEXLimitOrders();
  const order = existing.find((o) => o.id === orderId);
  if (order) {
    order.status = 'FILLED';
    if (txHash) order.txHash = txHash;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent('giwa_limit_orders_updated'));
  }
}
