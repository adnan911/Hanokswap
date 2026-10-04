import type { Address } from 'viem';
import {
  GIWA_PROTOCOL_FEE_VAULT,
  GIWA_DEX_FACTORY,
  GIWA_GAUGE_CONTROLLER,
} from '../contracts';

export interface TimelockTransaction {
  txHash: string;
  targetContract: Address;
  targetName: string;
  actionDescription: string;
  proposedBy: string;
  etaTimestamp: number;
  delayHours: number; // 48 hours min
  confirmations: number;
  requiredConfirmations: number; // 3 of 5 Safe
  status: 'QUEUED' | 'READY_TO_EXECUTE' | 'EXECUTED' | 'CANCELLED';
  queuedAt: number;
}

export const INITIAL_TIMELOCK_TRANSACTIONS: TimelockTransaction[] = [
  {
    txHash: '0x89f2a8901bc9102834710294819028471920481029481029481029481029381a',
    targetContract: GIWA_PROTOCOL_FEE_VAULT,
    targetName: 'ProtocolFeeVault',
    actionDescription: 'Update LP Fee Share from 70% to 75% (Treasury 15%, Burn 10%)',
    proposedBy: '0x89C10000000000000000000000000000000000AA',
    etaTimestamp: Date.now() + 3600 * 1000 * 18, // 18 hours remaining
    delayHours: 48,
    confirmations: 3,
    requiredConfirmations: 3,
    status: 'QUEUED',
    queuedAt: Date.now() - 3600 * 1000 * 30,
  },
  {
    txHash: '0x1b4f89012384710294819028471920481029481029481029481029381abcdef1',
    targetContract: GIWA_GAUGE_CONTROLLER,
    targetName: 'HanokGaugeController',
    actionDescription: 'Register new KRWC / USYC Institutional FX Pool Gauge',
    proposedBy: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    etaTimestamp: Date.now() - 3600 * 1000 * 2, // Ready to execute
    delayHours: 48,
    confirmations: 4,
    requiredConfirmations: 3,
    status: 'READY_TO_EXECUTE',
    queuedAt: Date.now() - 3600 * 1000 * 50,
  },
  {
    txHash: '0x5c901823901bc910283471029481902847192048102948102948102938100012',
    targetContract: GIWA_DEX_FACTORY,
    targetName: 'GiwaPoolFactory',
    actionDescription: 'Adjust standard tick spacing for 0.01% stableswap pools',
    proposedBy: '0x3a4f89d10e8bc12e457f9208a3d4f19b22a6c8e3',
    etaTimestamp: Date.now() - 3600 * 1000 * 72,
    delayHours: 48,
    confirmations: 3,
    requiredConfirmations: 3,
    status: 'EXECUTED',
    queuedAt: Date.now() - 3600 * 1000 * 120,
  },
];

const inMemoryTimelockTxs: TimelockTransaction[] = [...INITIAL_TIMELOCK_TRANSACTIONS];

export function getQueuedTimelockTransactions(): TimelockTransaction[] {
  return inMemoryTimelockTxs;
}

export function queueNewGovernanceProposal(
  targetContract: Address,
  targetName: string,
  actionDescription: string,
  proposedBy?: string
): TimelockTransaction {
  const randHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
  const newTx: TimelockTransaction = {
    txHash: randHash,
    targetContract,
    targetName,
    actionDescription,
    proposedBy: proposedBy || '0x89C1...00AA',
    etaTimestamp: Date.now() + 48 * 3600 * 1000, // 48h from now
    delayHours: 48,
    confirmations: 1, // Proposer confirmed
    requiredConfirmations: 3,
    status: 'QUEUED',
    queuedAt: Date.now(),
  };

  inMemoryTimelockTxs.unshift(newTx);
  return newTx;
}

export function executeTimelockProposal(txHash: string): boolean {
  const tx = inMemoryTimelockTxs.find((t) => t.txHash.toLowerCase() === txHash.toLowerCase());
  if (!tx || (tx.status !== 'QUEUED' && tx.status !== 'READY_TO_EXECUTE')) return false;
  tx.status = 'EXECUTED';
  return true;
}

export function cancelTimelockProposal(txHash: string): boolean {
  const tx = inMemoryTimelockTxs.find((t) => t.txHash.toLowerCase() === txHash.toLowerCase());
  if (!tx || tx.status === 'EXECUTED') return false;
  tx.status = 'CANCELLED';
  return true;
}
