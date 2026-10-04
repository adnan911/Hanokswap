import { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { useCurrency } from '../CurrencyContext';
import { useIsMobile } from '../useIsMobile';
import TradingViewChart from './TradingViewChart';
import {
  getPortfolioPositions,
  getAggregatePortfolioSummary,
  calculateImpermanentLoss,
  type PositionPnLMetrics,
} from '../lib/portfolioAnalytics';
import {
  fetchProtocolOverview,
  fetchRecentSwaps,
  type FactoryOverview,
  type SwapEventRecord,
} from '../lib/indexer';
import {
  Activity,
  Calculator,
  Layers,
  ArrowUpRight,
  Zap,
  Repeat,
} from 'lucide-react';

interface Props {
  userAddress?: string;
  onNavigateToPools?: () => void;
  onNavigateToSwap?: () => void;
}

export default function PortfolioAnalytics({ userAddress, onNavigateToPools, onNavigateToSwap }: Props) {
  const isMobile = useIsMobile();
  const { language } = useLanguage();
  const { formatCurrencyValue } = useCurrency();

  // State
  const [positions] = useState<PositionPnLMetrics[]>(getPortfolioPositions(userAddress));
  const [summary] = useState(getAggregatePortfolioSummary(positions));
  const [protocolOverview, setProtocolOverview] = useState<FactoryOverview | null>(null);
  const [recentSwaps, setRecentSwaps] = useState<SwapEventRecord[]>([]);

  // IL Calculator State
  const [simEntryPrice, setSimEntryPrice] = useState<number>(3000);
  const [simCurrentPrice, setSimCurrentPrice] = useState<number>(3600);
  const [simDepositUSD, setSimDepositUSD] = useState<number>(10000);

  useEffect(() => {
    fetchProtocolOverview().then(setProtocolOverview);
    fetchRecentSwaps(10).then(setRecentSwaps);
  }, []);

  // Compute simulated IL
  const { ilPct } = calculateImpermanentLoss(simEntryPrice, simCurrentPrice);
  const priceRatio = simCurrentPrice / (simEntryPrice || 1);
  const hodlValue = simDepositUSD * 0.5 * (1 + priceRatio);
  const lpValue = hodlValue * (1 + ilPct / 100);
  const ilLossUSD = lpValue - hodlValue;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: isMobile ? 460 : 1080, margin: '0 auto' }}>
      {/* Top Banner KPI Summary */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--card) 0%, var(--muted) 100%)',
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
                ENVIO &amp; GOLDSKY INDEXER
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>⚡ {protocolOverview?.subSecondIndexingLagMs || 180}ms HyperSync Lag</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {language === 'ko' ? '총 예치 자산 가치 (TVL & LP)' : 'Total Portfolio LP & Vault Value'}
            </div>
            <div className="prism-mono" style={{ fontSize: isMobile ? 32 : 44, fontWeight: 800, color: 'var(--foreground)', marginTop: 4 }}>
              {formatCurrencyValue(summary.totalCurrentValueUSD)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--card)', padding: '12px 18px', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700 }}>{language === 'ko' ? '총 순수익 (Net PnL)' : 'Total Net PnL'}</div>
              <div className="prism-mono" style={{ fontSize: 20, fontWeight: 800, color: summary.netPnlUSD >= 0 ? '#22c55e' : '#ef4444', marginTop: 2 }}>
                +{formatCurrencyValue(summary.netPnlUSD)} ({summary.netRoiPct.toFixed(2)}%)
              </div>
            </div>

            <div style={{ background: 'var(--card)', padding: '12px 18px', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700 }}>{language === 'ko' ? '미수령 누적 수수료' : 'Uncollected Fees'}</div>
              <div className="prism-mono" style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6', marginTop: 2 }}>
                {formatCurrencyValue(summary.totalUncollectedFeesUSD)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* High-Precision Chart & Trading Telemetry */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} color="var(--primary)" />
            <span>{language === 'ko' ? '고정밀 0.2초 실시간 Flashblocks 차트' : 'High-Precision 0.2s Flashblocks Chart'}</span>
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
              <span>{language === 'ko' ? '내 유동성 포지션 및 ALM 볼트' : 'My LP Positions & ALM Vaults'}</span>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {positions.map((pos) => (
              <div
                key={pos.positionId}
                style={{
                  background: 'var(--muted)',
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
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {pos.poolName}
                      {pos.isALMVault && (
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 800 }}>
                          ALM {pos.vaultStrategy}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                      Entry: ${pos.entryPrice} → Current: ${pos.currentPrice}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="prism-mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>
                      {formatCurrencyValue(pos.currentValueUSD)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e' }}>
                      +{formatCurrencyValue(pos.netPnlUSD)} ({pos.netRoiPct.toFixed(2)}%)
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-foreground)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  <span>Uncollected Fees: <strong style={{ color: '#3b82f6' }}>{formatCurrencyValue(pos.uncollectedFeesUSD)}</strong></span>
                  <span>Impermanent Loss: <strong style={{ color: '#ef4444' }}>{pos.impermanentLossPct.toFixed(2)}% ({formatCurrencyValue(pos.impermanentLossUSD)})</strong></span>
                  <span>APR: <strong style={{ color: 'var(--foreground)' }}>{pos.aprPercent}%</strong></span>
                </div>
              </div>
            ))}
          </div>
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
                style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Entry Price ($)</label>
                <input
                  type="number"
                  value={simEntryPrice}
                  onChange={(e) => setSimEntryPrice(Number(e.target.value))}
                  style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Future Price ($)</label>
                <input
                  type="number"
                  value={simCurrentPrice}
                  onChange={(e) => setSimCurrentPrice(Number(e.target.value))}
                  style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* Result Card */}
          <div style={{ background: 'var(--muted)', padding: 14, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
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

      {/* Real-time Subgraph Swaps Activity Stream */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, boxShadow: '0 10px 28px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} color="var(--primary)" />
            <span>{language === 'ko' ? 'Envio 실시간 스왑 트랜잭션 스트림 (Sub-500ms)' : 'Envio Real-Time Swap Event Stream (Sub-500ms)'}</span>
          </div>
          {onNavigateToSwap && (
            <button
              onClick={onNavigateToSwap}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span>{language === 'ko' ? '스왑하기' : 'Go to Swap'}</span>
              <Repeat size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recentSwaps.map((sw) => (
            <div
              key={sw.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: 12,
                background: 'var(--muted)',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 800, color: 'var(--foreground)' }}>{sw.poolName}</span>
                <span style={{ color: 'var(--muted-foreground)' }}>
                  {sw.amountIn} {sw.tokenInSymbol} → {sw.amountOut} {sw.tokenOutSymbol}
                </span>
                {sw.recipientUpId && (
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 700 }}>
                    {sw.recipientUpId}
                  </span>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, color: 'var(--foreground)' }}>{formatCurrencyValue(sw.amountUSD)}</div>
                <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Flashblock #{sw.flashblockIndex}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
