import { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { useCurrency } from '../CurrencyContext';
import { calculateKimchiPremium, formatKrw, type KimchiPremiumData } from '../lib/upbitKimchi';
import {
  Zap,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectArbitrageRoute?: (tokenIn: string, tokenOut: string) => void;
}

export function KimchiArbitrageModal({ isOpen, onClose, onSelectArbitrageRoute }: Props) {
  const { language } = useLanguage();
  const { rates } = useCurrency();
  const [data, setData] = useState<KimchiPremiumData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await calculateKimchiPremium();
      setData(res);
    } catch {}
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      const interval = setInterval(loadData, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          padding: 24,
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={24} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)' }}>
                {language === 'ko' ? '업비트 실시간 김치 프리미엄 & DEX 차익거래 레이더' : 'Upbit Kimchi Premium & Arbitrage Radar'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                {language === 'ko' ? '국내 1위 거래소 업비트 시세와 기와체인 DEX KRWC 풀 간의 실시간 스프레드 분석' : 'Live price spreads between Upbit KRW orderbook and Giwa DEX'}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--muted-foreground)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Global Market Rates Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          <div style={{ padding: 12, borderRadius: 14, background: 'var(--muted)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
              USD/KRW 기준 환율
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>
              ₩{(data?.usdKrwRate ?? rates.usdKrw).toLocaleString()}
            </div>
          </div>

          <div style={{ padding: 12, borderRadius: 14, background: 'var(--muted)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
              ETH 김치 프리미엄
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: (data?.ethKimchiPremiumPct ?? 0) > 0 ? '#22c55e' : '#ef4444' }}>
              {(data?.ethKimchiPremiumPct ?? 0) > 0 ? '+' : ''}{data?.ethKimchiPremiumPct ?? 0}%
            </div>
          </div>

          <div style={{ padding: 12, borderRadius: 14, background: 'var(--muted)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
              BTC 김치 프리미엄
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: (data?.btcKimchiPremiumPct ?? 0) > 0 ? '#22c55e' : '#ef4444' }}>
              {(data?.btcKimchiPremiumPct ?? 0) > 0 ? '+' : ''}{data?.btcKimchiPremiumPct ?? 0}%
            </div>
          </div>
        </div>

        {/* Live Arbitrage Opportunities List */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={16} color="var(--primary)" />
              {language === 'ko' ? '실시간 감지된 차익거래 기회' : 'Detected Arbitrage Spreads'}
            </div>
            <button
              onClick={loadData}
              disabled={isLoading}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              {language === 'ko' ? '새로고침' : 'Refresh'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data?.arbitrage.map((arb) => (
              <div
                key={arb.asset}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: 'var(--muted)',
                  border: arb.isProfitableAfterFees ? '1px solid #22c55e' : '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>
                      {arb.asset} 차익거래
                    </span>
                    {arb.isProfitableAfterFees ? (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontWeight: 800, border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                        PROFITABLE SPREAD
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(156, 163, 175, 0.15)', color: 'var(--muted-foreground)', fontWeight: 700 }}>
                        LOW SPREAD
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', gap: 14 }}>
                    <span>업비트: <strong style={{ color: 'var(--foreground)' }}>{formatKrw(arb.upbitPriceKRW)}</strong></span>
                    <span>하옥 DEX: <strong style={{ color: 'var(--foreground)' }}>{formatKrw(arb.giwaDexPriceKRWC)}</strong></span>
                    <span>스프레드: <strong style={{ color: arb.spreadPercent > 0 ? '#22c55e' : '#ef4444' }}>{arb.spreadPercent > 0 ? '+' : ''}{arb.spreadPercent}%</strong></span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>1 단위 예상 수익</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>
                      +₩{Math.max(0, arb.estimatedProfit1ETH_KRW).toLocaleString()}
                    </div>
                  </div>

                  {onSelectArbitrageRoute && (
                    <button
                      onClick={() => {
                        onSelectArbitrageRoute(arb.asset === 'ETH' ? 'WETH' : 'USDC', 'KRWC');
                        onClose();
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: 'var(--primary)',
                        color: '#fff',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>스왑 실행</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Traditional Hanok Giwa Advantage Box */}
        <div style={{ padding: 14, borderRadius: 14, background: 'oklch(0.6724 0.1308 38.7559 / 0.1)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
          <span>
            {language === 'ko'
              ? '기와체인 0.2초 Flashblocks를 통해 블록 대기 시간 없이 즉시 온체인 차익거래(Arbitrage)를 체결할 수 있습니다.'
              : 'Execute sub-second on-chain arbitrage trades instantly with Giwa Chain 0.2s Flashblocks.'}
          </span>
        </div>
      </div>
    </div>
  );
}
