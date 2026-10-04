import { type Address } from 'viem';

export type DCAStreamStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface DEXDCAStream {
  id: string;
  owner: Address;
  tokenInSymbol: string;
  tokenOutSymbol: string;
  tokenInAddress: Address;
  tokenOutAddress: Address;
  totalAmountIn: string;
  amountPerInterval: string;
  frequency: 'HOURLY' | 'DAILY' | 'WEEKLY';
  intervalSeconds: number;
  totalIntervals: number;
  intervalsCompleted: number;
  createdAt: number;
  nextExecutionTime: number;
  status: DCAStreamStatus;
  txHash?: string;
}

const DCA_STORAGE_KEY = 'hanokswap_giwa_dca_streams_v1';

export function getDEXDCAStreams(user?: Address): DEXDCAStream[] {
  try {
    const raw = localStorage.getItem(DCA_STORAGE_KEY);
    const all: DEXDCAStream[] = raw ? JSON.parse(raw) : [];
    if (!user) return all;
    return all.filter((s) => s.owner.toLowerCase() === user.toLowerCase());
  } catch {
    return [];
  }
}

export function saveDEXDCAStream(stream: DEXDCAStream): void {
  const existing = getDEXDCAStreams();
  const filtered = existing.filter((s) => s.id !== stream.id);
  filtered.unshift(stream);
  localStorage.setItem(DCA_STORAGE_KEY, JSON.stringify(filtered));
  window.dispatchEvent(new CustomEvent('giwa_dca_streams_updated'));
}

export function cancelDEXDCAStream(streamId: string): void {
  const existing = getDEXDCAStreams();
  const stream = existing.find((s) => s.id === streamId);
  if (stream) {
    stream.status = 'CANCELLED';
    localStorage.setItem(DCA_STORAGE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent('giwa_dca_streams_updated'));
  }
}

export function executeNextDCAInterval(streamId: string): void {
  const existing = getDEXDCAStreams();
  const stream = existing.find((s) => s.id === streamId);
  if (stream && stream.status === 'ACTIVE') {
    stream.intervalsCompleted++;
    if (stream.intervalsCompleted >= stream.totalIntervals) {
      stream.status = 'COMPLETED';
    } else {
      stream.nextExecutionTime = Date.now() + stream.intervalSeconds * 1000;
    }
    localStorage.setItem(DCA_STORAGE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent('giwa_dca_streams_updated'));
  }
}
