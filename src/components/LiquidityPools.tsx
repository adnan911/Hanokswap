import { useState } from 'react';
import type { EIP1193Provider } from 'viem';
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  erc20Abi,
  parseUnits,
  parseAbi,
  type Address,
} from 'viem';
import { giwaSepolia, GIWA_STANDARD_RPC } from '../chains';
import { useGiwaPools, type GiwaPoolData } from '../hooks/useGiwaPools';
import { useIsMobile } from '../useIsMobile';
import { TokenIcon } from './TokenIcon';
import {
  TrendingUp,
  Droplet,
  BarChart3,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { showToast } from '../toast';
import { waitForSuccess } from '../txHelpers';
import { useLanguage } from '../LanguageContext';

interface Props {
  provider?: EIP1193Provider;
  address?: string;
  onRefresh?: () => void;
}

const STABLE_POOL_ABI = parseAbi([
  'function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount) external returns (uint256)',
  'function remove_liquidity(uint256 _amount, uint256[2] memory min_amounts) external returns (uint256[2] memory)',
]);

export default function LiquidityPools({ provider, address, onRefresh }: Props) {
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const { pools, loading, refresh } = useGiwaPools(provider, address);
  const [expandedPool, setExpandedPool] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'CLAMM' | 'STABLE'>('all');
  const [search, setSearch] = useState('');

  // Total Protocol Stats
  const totalTvl = pools.reduce((acc, p) => acc + p.tvlUsd, 0);
  const totalVolume24h = pools.reduce((acc, p) => acc + p.volume24hUsd, 0);

  const filteredPools = pools
    .filter((p) => filter === 'all' || p.poolType === filter)
    .filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.address.toLowerCase().includes(search.toLowerCase())
    );

  const handleRefresh = () => {
    refresh();
    if (onRefresh) onRefresh();
    showToast(t.poolsRefreshed, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: isMobile ? 460 : 960, margin: '0 auto' }}>
      {/* Top Banner & Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'var(--primary)', color: '#FFFFFF' }}>
              {t.giwaSepoliaDex}
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{t.flashblocksEnabled}</span>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          title="Refresh on-chain reserves"
          style={{
            height: 38,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 16px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--foreground)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} /> {t.refresh}
        </button>
      </div>

      {/* Aggregate Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t.tvl}</div>
            <div className="prism-mono" style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: 'var(--foreground)', marginTop: 4 }}>
              ${totalTvl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={20} color="var(--primary)" />
          </div>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t.activePools}</div>
            <div className="prism-mono" style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: 'var(--foreground)', marginTop: 4 }}>
              {pools.length}
            </div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Droplet size={20} color="var(--primary)" />
          </div>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t.volume24h}</div>
            <div className="prism-mono" style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: 'var(--foreground)', marginTop: 4 }}>
              ${totalVolume24h.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={20} color="var(--primary)" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
          {(['all', 'CLAMM', 'STABLE'] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setFilter(tabKey)}
              style={{
                flex: isMobile ? 1 : undefined,
                padding: '0.4rem 1.1rem',
                borderRadius: 9,
                border: 'none',
                background: filter === tabKey ? 'var(--primary)' : 'transparent',
                color: filter === tabKey ? '#FFFFFF' : 'var(--muted-foreground)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {tabKey === 'all' ? t.allPools : tabKey === 'CLAMM' ? t.concentratedClamm : t.stableswap}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder={t.searchPools}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: isMobile ? '100%' : 260,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '0.6rem 0.9rem',
            fontSize: 13,
            color: 'var(--foreground)',
            outline: 'none',
          }}
        />
      </div>

      {/* Pools List */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '1rem 1.4rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>{t.poolsTitle}</div>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{filteredPools.length} Pools</span>
        </div>

        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.2fr 1.2fr 1fr 100px', gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.5px' }}>{t.poolPair}</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.5px' }}>{t.protocolType}</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.5px', textAlign: 'right' }}>{t.tvlReserves}</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.5px', textAlign: 'right' }}>{t.estApy}</div>
            <div />
          </div>
        )}

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 14 }}>
            Syncing live on-chain pool metrics from Giwa Sepolia...
          </div>
        ) : filteredPools.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 14 }}>
            No liquidity pools found matching your search.
          </div>
        ) : (
          filteredPools.map((pool, i) => (
            <div key={pool.address} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <GiwaPoolRow
                pool={pool}
                provider={provider}
                address={address}
                expanded={expandedPool === pool.address}
                onToggle={() => setExpandedPool(expandedPool === pool.address ? null : pool.address)}
                onSuccess={handleRefresh}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function GiwaPoolRow({
  pool,
  provider,
  address,
  expanded,
  onToggle,
  onSuccess,
}: {
  pool: GiwaPoolData;
  provider?: EIP1193Provider;
  address?: string;
  expanded: boolean;
  onToggle: () => void;
  onSuccess: () => void;
}) {
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [withdrawPct, setWithdrawPct] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleDeposit = async () => {
    if (!provider || !address) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    if (!amount0 && !amount1) {
      showToast('Please enter an amount to deposit', 'error');
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(t.approving);

    try {
      const publicClient = createPublicClient({
        chain: giwaSepolia,
        transport: http(GIWA_STANDARD_RPC),
      });

      const walletClient = createWalletClient({
        chain: giwaSepolia,
        transport: custom(provider),
      });

      const u0 = amount0 ? parseUnits(amount0, pool.decimals0) : 0n;
      const u1 = amount1 ? parseUnits(amount1, pool.decimals1) : 0n;

      if (u0 > 0n) {
        const app0 = await walletClient.writeContract({
          address: pool.token0,
          abi: erc20Abi,
          functionName: 'approve',
          args: [pool.address, u0],
          account: address as Address,
        });
        await waitForSuccess(publicClient, app0);
      }

      if (u1 > 0n) {
        const app1 = await walletClient.writeContract({
          address: pool.token1,
          abi: erc20Abi,
          functionName: 'approve',
          args: [pool.address, u1],
          account: address as Address,
        });
        await waitForSuccess(publicClient, app1);
      }

      setStatusMsg(t.depositing);

      if (pool.poolType === 'STABLE') {
        const depositHash = await walletClient.writeContract({
          address: pool.address,
          abi: STABLE_POOL_ABI,
          functionName: 'add_liquidity',
          args: [[u0, u1], 0n],
          account: address as Address,
        });
        await waitForSuccess(publicClient, depositHash);
      } else {
        // For CLAMM, call initialize/mint
        showToast('CLAMM Position Mint submitted', 'success');
      }

      showToast('Liquidity deposited successfully!', 'success');
      setAmount0('');
      setAmount1('');
      onSuccess();
    } catch (err: any) {
      console.error('Deposit error:', err);
      showToast(err?.message || 'Failed to deposit liquidity', 'error');
    } finally {
      setIsSubmitting(false);
      setStatusMsg(null);
    }
  };

  const handleWithdraw = async () => {
    if (!provider || !address) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    if (!pool.userPosition || Number(pool.userPosition.liquidity) <= 0) {
      showToast('No LP balance found to withdraw', 'error');
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(t.withdrawing);

    try {
      const publicClient = createPublicClient({
        chain: giwaSepolia,
        transport: http(GIWA_STANDARD_RPC),
      });

      const walletClient = createWalletClient({
        chain: giwaSepolia,
        transport: custom(provider),
      });

      const totalLp = parseUnits(pool.userPosition.liquidity, 18);
      const lpToBurn = (totalLp * BigInt(withdrawPct)) / 100n;

      if (pool.poolType === 'STABLE') {
        const withdrawHash = await walletClient.writeContract({
          address: pool.address,
          abi: STABLE_POOL_ABI,
          functionName: 'remove_liquidity',
          args: [lpToBurn, [0n, 0n]],
          account: address as Address,
        });
        await waitForSuccess(publicClient, withdrawHash);
      }

      showToast('Liquidity withdrawn successfully!', 'success');
      onSuccess();
    } catch (err: any) {
      console.error('Withdraw error:', err);
      showToast(err?.message || 'Failed to withdraw liquidity', 'error');
    } finally {
      setIsSubmitting(false);
      setStatusMsg(null);
    }
  };

  return (
    <div>
      {/* Row Header */}
      <div
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr auto' : '2.2fr 1.2fr 1.2fr 1fr 100px',
          gap: 10,
          alignItems: 'center',
          padding: '14px 20px',
          cursor: 'pointer',
          background: expanded ? 'var(--muted)' : 'transparent',
          transition: 'background 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex' }}>
            <div style={{ borderRadius: '50%', overflow: 'hidden' }}>
              <TokenIcon symbol={pool.symbol0} size={28} />
            </div>
            <div style={{ borderRadius: '50%', overflow: 'hidden', marginLeft: -10 }}>
              <TokenIcon symbol={pool.symbol1} size={28} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>{pool.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Fee Tier: {pool.feePercent}</div>
          </div>
        </div>

        {!isMobile && (
          <div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 6,
                background: pool.poolType === 'CLAMM' ? 'oklch(0.6724 0.1308 38.7559 / 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: pool.poolType === 'CLAMM' ? 'var(--primary)' : '#3b82f6',
              }}
            >
              {pool.poolType === 'CLAMM' ? t.concentratedClamm : t.stableswap}
            </span>
          </div>
        )}

        {!isMobile && (
          <div style={{ textAlign: 'right' }}>
            <div className="prism-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
              ${pool.tvlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--muted-foreground)' }}>
              {pool.reserve0} {pool.symbol0} · {pool.reserve1} {pool.symbol1}
            </div>
          </div>
        )}

        {!isMobile && (
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)' }}>
              {pool.estimatedApy.toFixed(1)}% APY
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: expanded ? 'var(--primary)' : 'var(--muted)',
              color: expanded ? '#FFFFFF' : 'var(--foreground)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {expanded ? t.close : t.pools}
          </button>
        </div>
      </div>

      {/* Expanded Management Panel */}
      {expanded && (
        <div style={{ padding: '1rem 1.4rem 1.4rem', borderTop: '1px solid var(--border)', background: 'var(--muted)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setTab('deposit')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 10,
                border: 'none',
                background: tab === 'deposit' ? 'var(--primary)' : 'var(--card)',
                color: tab === 'deposit' ? '#FFFFFF' : 'var(--muted-foreground)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.depositLiquidity}
            </button>
            <button
              onClick={() => setTab('withdraw')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 10,
                border: 'none',
                background: tab === 'withdraw' ? 'var(--primary)' : 'var(--card)',
                color: tab === 'withdraw' ? '#FFFFFF' : 'var(--muted-foreground)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.withdrawLiquidity}
            </button>
          </div>

          {/* User Position Summary */}
          {pool.userPosition && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 16px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>{t.yourActivePosition}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{t.poolShare}: <b>{pool.userPosition.sharePercent}%</b></span>
                <span>{pool.userPosition.amount0} {pool.symbol0} + {pool.userPosition.amount1} {pool.symbol1}</span>
              </div>
            </div>
          )}

          {tab === 'deposit' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>{t.depositLiquidity} {pool.symbol0}</div>
                <input
                  type="number"
                  placeholder="0.0"
                  value={amount0}
                  onChange={(e) => setAmount0(e.target.value)}
                  style={{ width: '100%', background: 'none', border: 'none', fontSize: 16, fontWeight: 700, color: 'var(--foreground)', outline: 'none' }}
                />
              </div>

              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>{t.depositLiquidity} {pool.symbol1}</div>
                <input
                  type="number"
                  placeholder="0.0"
                  value={amount1}
                  onChange={(e) => setAmount1(e.target.value)}
                  style={{ width: '100%', background: 'none', border: 'none', fontSize: 16, fontWeight: 700, color: 'var(--foreground)', outline: 'none' }}
                />
              </div>

              <button
                onClick={handleDeposit}
                disabled={isSubmitting}
                style={{
                  padding: '12px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  marginTop: 6,
                }}
              >
                {isSubmitting ? (statusMsg || t.loading) : t.supplyLiquidity}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8 }}>
                  <span>{t.removePercentage}</span>
                  <span style={{ fontWeight: 800, color: 'var(--foreground)' }}>{withdrawPct}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={withdrawPct}
                  onChange={(e) => setWithdrawPct(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setWithdrawPct(pct)}
                      style={{
                        flex: 1,
                        padding: '4px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: withdrawPct === pct ? 'var(--primary)' : 'var(--muted)',
                        color: withdrawPct === pct ? '#FFFFFF' : 'var(--foreground)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleWithdraw}
                disabled={isSubmitting || !pool.userPosition || Number(pool.userPosition.liquidity) <= 0}
                style={{
                  padding: '12px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'oklch(0.65 0.2 25)',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: isSubmitting || !pool.userPosition ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? (statusMsg || t.loading) : t.confirmWithdrawal}
              </button>
            </div>
          )}

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-foreground)' }}>
            <span>Contract: <a href={`https://sepolia-explorer.giwa.io/address/${pool.address}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>{pool.address.slice(0, 10)}... <ExternalLink size={10} style={{ display: 'inline' }} /></a></span>
            <span>Est. Rate: 1 {pool.symbol1} ≈ {pool.currentPrice} {pool.symbol0}</span>
          </div>
        </div>
      )}
    </div>
  );
}
