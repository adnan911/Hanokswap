import { useState, useMemo } from 'react';
import { useLanguage } from '../LanguageContext';
import { useCurrency } from '../CurrencyContext';
import { useIsMobile } from '../useIsMobile';
import TradingViewChart from './TradingViewChart';
import { useGiwaPools } from '../hooks/useGiwaPools';
import {
  derivePositionsFromPools,
  getAggregatePortfolioSummary,
  calculateImpermanentLoss,
} from '../lib/portfolioAnalytics';
import {
  Activity,
  Calculator,
  Layers,
  ArrowUpRight,
  Droplets,
  PlusCircle,
  BarChart3,
} from 'lucide-react';

interface Props {
  userAddress?: string;
  onNavigateToPools?: () => void;
  onNavigateToSwap?: () => void;
}

export default function PortfolioAnalytics({ userAddress, onNavigateToPools }: Props) {
  const isMobile = useIsMobile();
  const { language } = useLanguage();
  const { formatCurrencyValue, rates } = useCurrency();
  const { pools, loading: poolsLoading } = useGiwaPools(undefined, userAddress);

  // Derive real user positions from live on-chain pools
  const positions = useMemo(() => derivePositionsFromPools(pools), [pools]);
  const summary = useMemo(() => getAggregatePortfolioSummary(positions, rates.usdKrw), [positions, rates.usdKrw]);

  // Protocol Stats from on-chain pools
  const protocolTvlUSD = pools.reduce((acc, p) => acc + p.tvlUsd, 0);
  const protocolVolume24hUSD = pools.reduce((acc, p) => acc + p.volume24hUsd, 0);

  // IL Calculator State
  const [simEntryPrice, setSimEntryPrice] = useState<number>(3150);
  const [simCurrentPrice, setSimCurrentPrice] = useState<number>(3600);
  const [simDepositUSD, setSimDepositUSD] = useState<number>(5000);

  // Compute simulated IL
  const { ilPct } = calculateImpermanentLoss(simEntryPrice, simCurrentPrice);
  const priceRatio = simCurrentPrice / (simEntryPrice || 1);
  const hodlValue = simDepositUSD * 0.5 * (1 + priceRatio);
  const lpValue = hodlValue * (1 + ilPct / 100);
  const ilLossUSD = lpValue - hodlValue;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: isMobile ? 460 : 1080, margin: '0 auto', width: '100%' }}>
      {/* Top Banner KPI Summary */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--card) 0%, var(--card-solid) 100%)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          padding: isMobile ? '1.25rem' : '2rem',
          boxShadow: '0 20px 48px rgba(0,0,0,0.25)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: 'var(--primary)', color: '#FFFFFF' }}>
                GIWA DEX TELEMETRY
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>⚡ 0.2s Flashblocks Sub-second Execution</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {language === 'ko' ? '프로토콜 총 유치 자산 (Protocol TVL)' : 'Total Protocol Locked Value (TVL)'}
            </div>
            <div className="prism-mono" style={{ fontSize: isMobile ? 32 : 44, fontWeight: 800, color: 'var(--foreground)', marginTop: 4 }}>
              {poolsLoading ? '…' : formatCurrencyValue(protocolTvlUSD)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--secondary)', padding: '12px 18px', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700 }}>{language === 'ko' ? '24시간 총 거래량' : '24h Total Volume'}</div>
              <div className="prism-mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', marginTop: 2 }}>
                {formatCurrencyValue(protocolVolume24hUSD)}
              </div>
            </div>

            <div style={{ background: 'var(--secondary)', padding: '12px 18px', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700 }}>{language === 'ko' ? '내 활성 LP 자산' : 'My Active LP Value'}</div>
              <div className="prism-mono" style={{ fontSize: 20, fontWeight: 800, color: summary.totalCurrentValueUSD > 0 ? 'var(--primary)' : 'var(--muted-foreground)', marginTop: 2 }}>
                {formatCurrencyValue(summary.totalCurrentValueUSD)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* High-Precision Real Chart */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} color="var(--primary)" />
            <span>{language === 'ko' ? '실시간 거래소 마켓 캔들스틱 차트 (Real-Time Feed)' : 'Real-Time Market Candlestick Chart (Live Feed)'}</span>
          </div>
        </div>
        <TradingViewChart symbol="ETH" />
      </div>

      {/* Grid: Active Positions & Interactive IL Calculator */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: '1.5rem' }}>
        {/* Active LP Positions Table */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, boxShadow: '0 10px 28px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={18} color="var(--primary)" />
              <span>{language === 'ko' ? '내 유동성 포지션' : 'My Active LP Positions'}</span>
            </div>
            {onNavigateToPools && (
              <button
                onClick={onNavigateToPools}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <span>{language === 'ko' ? '풀 관리' : 'Manage Pools'}</span>
                <ArrowUpRight size={14} />
              </button>
            )}
          </div>

          {positions.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Droplets size={34} color="var(--muted-foreground)" />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
                {language === 'ko' ? '활성화된 유동성 포지션이 없습니다' : 'No Active LP Positions'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', maxWidth: 300 }}>
                {language === 'ko'
                  ? 'GIWA 온체인 풀에 유동성을 공급하여 거래 수수료를 실시간으로 수령하세요.'
                  : 'Provide liquidity to GIWA on-chain pools to start tracking position yield and fee APR.'}
              </div>
              {onNavigateToPools && (
                <button
                  onClick={onNavigateToPools}
                  className="uniswap-btn-primary"
                  style={{ width: 'auto', padding: '8px 16px', fontSize: 12.5, borderRadius: 10, marginTop: 6 }}
                >
                  <PlusCircle size={14} />
                  <span>{language === 'ko' ? '유동성 공급하기' : 'Deposit Liquidity'}</span>
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {positions.map((pos) => (
                <div
                  key={pos.positionId}
                  style={{
                    background: 'var(--secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>
                        {pos.poolName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                        {pos.token0Symbol} / {pos.token1Symbol}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="prism-mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>
                        {formatCurrencyValue(pos.currentValueUSD)}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e' }}>
                        APR: {pos.aprPercent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Interactive Impermanent Loss Calculator */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, boxShadow: '0 10px 28px rgba(0,0,0,0.15)' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Calculator size={18} color="var(--primary)" />
            <span>{language === 'ko' ? '비영구적 손실(IL) 시뮬레이터' : 'Impermanent Loss Calculator'}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Initial Deposit ($)</label>
              <input
                type="number"
                value={simDepositUSD}
                onChange={(e) => setSimDepositUSD(Number(e.target.value))}
                style={{ width: '100%', background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Entry Price ($)</label>
                <input
                  type="number"
                  value={simEntryPrice}
                  onChange={(e) => setSimEntryPrice(Number(e.target.value))}
                  style={{ width: '100%', background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Future Price ($)</label>
                <input
                  type="number"
                  value={simCurrentPrice}
                  onChange={(e) => setSimCurrentPrice(Number(e.target.value))}
                  style={{ width: '100%', background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* Result Card */}
          <div style={{ background: 'var(--secondary)', padding: 14, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--muted-foreground)' }}>Price Change:</span>
              <span style={{ fontWeight: 800, color: priceRatio >= 1 ? '#22c55e' : '#ef4444' }}>
                {((priceRatio - 1) * 100).toFixed(1)}%
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--muted-foreground)' }}>Impermanent Loss (IL):</span>
              <span style={{ fontWeight: 800, color: '#ef4444' }}>
                {ilPct.toFixed(2)}% ({formatCurrencyValue(ilLossUSD)})
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--muted-foreground)' }}>HODL Strategy Value:</span>
              <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{formatCurrencyValue(hodlValue)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--muted-foreground)' }}>LP Strategy Value:</span>
              <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{formatCurrencyValue(lpValue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* On-Chain Pools Breakdown */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, boxShadow: '0 10px 28px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={18} color="var(--primary)" />
            <span>{language === 'ko' ? 'GIWA 온체인 풀 현황 (Live Pool Analytics)' : 'GIWA On-Chain Pool Analytics'}</span>
          </div>
          {onNavigateToPools && (
            <button
              onClick={onNavigateToPools}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span>{language === 'ko' ? '모든 풀 보기' : 'View All Pools'}</span>
              <ArrowUpRight size={13} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pools.map((p) => (
            <div
              key={p.address}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                borderRadius: 14,
                background: 'var(--secondary)',
                fontSize: 13,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 800, color: 'var(--foreground)' }}>{p.name}</span>
                <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, background: 'var(--accent)', color: 'var(--primary)', fontWeight: 700 }}>
                  {p.poolType} ({p.feePercent})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>TVL</div>
                  <div className="prism-mono" style={{ fontWeight: 800, color: 'var(--foreground)' }}>{formatCurrencyValue(p.tvlUsd)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Est. APY</div>
                  <div className="prism-mono" style={{ fontWeight: 800, color: '#22c55e' }}>{p.estimatedApy.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
