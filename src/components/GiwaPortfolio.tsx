import { useState, useEffect, useCallback } from 'react';
import type { EIP1193Provider, Address } from 'viem';
import { createPublicClient, http, erc20Abi, formatUnits } from 'viem';
import { giwaSepolia, GIWA_STANDARD_RPC } from '../chains';
import {
  GIWA_WETH,
  USDC_ADDRESS,
  KRWC_ADDRESS,
  EURC_ADDRESS,
  GIWA_HANOK_TOKEN,
} from '../contracts';
import { useGiwaPools } from '../hooks/useGiwaPools';
import { useDojang } from '../hooks/useDojang';
import { formatUpIdDisplay } from '../lib/dojang';
import { useLanguage } from '../LanguageContext';
import { useCurrency } from '../CurrencyContext';
import { useIsMobile } from '../useIsMobile';
import { TokenIcon } from './TokenIcon';
import EmptyState from './EmptyState';
import {
  Wallet,
  RefreshCw,
  Sparkles,
  Droplets,
  Repeat,
  PlusCircle,
  Coins,
  ArrowUpRight,
} from 'lucide-react';

interface Props {
  address?: string;
  provider?: EIP1193Provider;
  onNavigate?: (tab: string) => void;
}

interface TokenHolding {
  symbol: string;
  name: string;
  address: Address;
  balance: string;
  rawBalance: number;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
  color: string;
}

export default function GiwaPortfolio({ address, provider, onNavigate }: Props) {
  const { language } = useLanguage();
  const { formatCurrencyValue, rates } = useCurrency();
  const isMobile = useIsMobile();
  const { profile: dojangProfile } = useDojang(address as Address | undefined);
  const { pools, loading: poolsLoading, refresh: refreshPools } = useGiwaPools(provider, address);

  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [loading, setLoading] = useState(false);
  const [ethPriceUsd, setEthPriceUsd] = useState(3150);

  const fetchLivePrices = useCallback(async () => {
    try {
      const res = await fetch('/api/upbit-proxy?path=' + encodeURIComponent('/ticker?markets=KRW-ETH,KRW-USDT,KRW-BTC'));
      if (res.ok) {
        const data = await res.json();
        const ethItem = data.find((d: any) => d.market === 'KRW-ETH');
        const usdtItem = data.find((d: any) => d.market === 'KRW-USDT');
        if (ethItem && usdtItem && usdtItem.trade_price > 0) {
          const derivedEthUsd = ethItem.trade_price / usdtItem.trade_price;
          setEthPriceUsd(derivedEthUsd);
        }
      }
    } catch {
      // Keep sensible defaults
    }
  }, []);

  const fetchBalances = useCallback(async () => {
    if (!address || !address.startsWith('0x')) {
      setHoldings([]);
      return;
    }

    setLoading(true);
    const client = createPublicClient({
      chain: giwaSepolia,
      transport: http(GIWA_STANDARD_RPC),
    });

    try {
      const userAddr = address as Address;

      // 1. Fetch native ETH
      const ethBalRaw = await client.getBalance({ address: userAddr });
      const ethBal = parseFloat(formatUnits(ethBalRaw, 18));

      // 2. Fetch ERC20 tokens
      const [wethBalRaw, usdcBalRaw, krwcBalRaw, eurcBalRaw, hanokBalRaw] = await Promise.all([
        client.readContract({ address: GIWA_WETH, abi: erc20Abi, functionName: 'balanceOf', args: [userAddr] }).catch(() => 0n),
        client.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [userAddr] }).catch(() => 0n),
        client.readContract({ address: KRWC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [userAddr] }).catch(() => 0n),
        client.readContract({ address: EURC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [userAddr] }).catch(() => 0n),
        client.readContract({ address: GIWA_HANOK_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [userAddr] }).catch(() => 0n),
      ]);

      const wethBal = parseFloat(formatUnits(wethBalRaw, 18));
      const usdcBal = parseFloat(formatUnits(usdcBalRaw, 6));
      const krwcBal = parseFloat(formatUnits(krwcBalRaw, 18));
      const eurcBal = parseFloat(formatUnits(eurcBalRaw, 6));
      const hanokBal = parseFloat(formatUnits(hanokBalRaw, 18));

      const krwUsdRate = 1 / (rates.usdKrw || 1400);

      const list: TokenHolding[] = [
        {
          symbol: 'ETH',
          name: 'Native Ether (GIWA Gas)',
          address: '0x0000000000000000000000000000000000000000' as Address,
          balance: ethBal.toFixed(4),
          rawBalance: ethBal,
          decimals: 18,
          priceUsd: ethPriceUsd,
          valueUsd: ethBal * ethPriceUsd,
          color: '#627EEA',
        },
        {
          symbol: 'WETH',
          name: 'Wrapped Ether',
          address: GIWA_WETH,
          balance: wethBal.toFixed(4),
          rawBalance: wethBal,
          decimals: 18,
          priceUsd: ethPriceUsd,
          valueUsd: wethBal * ethPriceUsd,
          color: '#EC4899',
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          address: USDC_ADDRESS,
          balance: usdcBal.toFixed(2),
          rawBalance: usdcBal,
          decimals: 6,
          priceUsd: 1.0,
          valueUsd: usdcBal * 1.0,
          color: '#2775CA',
        },
        {
          symbol: 'KRWC',
          name: 'Dunamu KRW Coin',
          address: KRWC_ADDRESS,
          balance: krwcBal.toLocaleString('en-US', { maximumFractionDigits: 0 }),
          rawBalance: krwcBal,
          decimals: 18,
          priceUsd: krwUsdRate,
          valueUsd: krwcBal * krwUsdRate,
          color: '#FF5A36',
        },
        {
          symbol: 'EURC',
          name: 'Euro Coin',
          address: EURC_ADDRESS,
          balance: eurcBal.toFixed(2),
          rawBalance: eurcBal,
          decimals: 6,
          priceUsd: 1.08,
          valueUsd: eurcBal * 1.08,
          color: '#10B981',
        },
        {
          symbol: 'HANOK',
          name: 'Hanok Governance Token',
          address: GIWA_HANOK_TOKEN,
          balance: hanokBal.toFixed(2),
          rawBalance: hanokBal,
          decimals: 18,
          priceUsd: 0.25,
          valueUsd: hanokBal * 0.25,
          color: '#F59E0B',
        },
      ];

      setHoldings(list);
    } catch {
      // graceful fallback
    } finally {
      setLoading(false);
    }
  }, [address, ethPriceUsd, rates.usdKrw]);

  useEffect(() => {
    fetchLivePrices();
    fetchBalances();
  }, [fetchLivePrices, fetchBalances]);

  const totalWalletValueUsd = holdings.reduce((sum, h) => sum + h.valueUsd, 0);

  // Active User LP Positions from on-chain pools
  const userPositions = pools.filter(
    (p) => p.userPosition && parseFloat(p.userPosition.liquidity) > 0
  );

  const totalLpValueUsd = userPositions.reduce((sum, p) => {
    const share = parseFloat(p.userPosition?.sharePercent || '0') / 100;
    return sum + p.tvlUsd * share;
  }, 0);

  const grandTotalNetWorthUsd = totalWalletValueUsd + totalLpValueUsd;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Top Banner: Total Portfolio Net Worth */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--card) 0%, var(--card-solid) 100%)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          padding: isMobile ? '1.25rem' : '2rem',
          boxShadow: '0 20px 48px rgba(0,0,0,0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 9999,
                background: 'var(--accent)',
                color: 'var(--primary)',
                border: '1px solid rgba(255, 90, 54, 0.25)',
              }}
            >
              GIWA SEPOLIA WALLET
            </span>
            {dojangProfile?.upIdName && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 9999,
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Sparkles size={11} />
                {formatUpIdDisplay(dojangProfile.upIdName)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {language === 'ko' ? '총 보유 자산 가치 (순자산)' : 'Total Net Worth'}
          </div>
          <div style={{ fontSize: isMobile ? 32 : 44, fontWeight: 800, color: 'var(--foreground)', marginTop: 4, letterSpacing: '-0.02em' }}>
            {formatCurrencyValue(grandTotalNetWorthUsd)}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {onNavigate && (
            <>
              <button
                onClick={() => onNavigate('swap')}
                className="uniswap-btn-primary"
                style={{ width: 'auto', padding: '10px 18px', fontSize: 13.5, borderRadius: 12 }}
              >
                <Repeat size={15} />
                <span>{language === 'ko' ? '스왑하기' : 'Trade'}</span>
              </button>
              <button
                onClick={() => onNavigate('pools')}
                style={{
                  padding: '10px 18px',
                  borderRadius: 12,
                  background: 'var(--secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Droplets size={15} color="var(--primary)" />
                <span>{language === 'ko' ? '유동성 추가' : 'Add LP'}</span>
              </button>
            </>
          )}
          <button
            onClick={() => {
              fetchBalances();
              refreshPools();
            }}
            aria-label="Refresh balances"
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--secondary)',
              color: 'var(--foreground)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} className={loading || poolsLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Grid: Token Balances & Active LP Positions */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: '1.5rem' }}>
        {/* Token Holdings Table */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Coins size={18} color="var(--primary)" />
              <span>{language === 'ko' ? '지갑 보유 토큰' : 'Wallet Tokens'}</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 700 }}>
              {formatCurrencyValue(totalWalletValueUsd)}
            </span>
          </div>

          {!address ? (
            <EmptyState
              icon={<Wallet size={28} color="var(--primary)" />}
              title={language === 'ko' ? '지갑을 연결하세요' : 'Connect Your Wallet'}
              subtitle={language === 'ko' ? 'GIWA Sepolia 잔액을 조회하려면 지갑을 연결하세요.' : 'Connect to inspect your on-chain assets.'}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {holdings.map((token) => (
                <div
                  key={token.symbol}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'var(--secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <TokenIcon symbol={token.symbol} size={32} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>
                        {token.symbol}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                        {token.name}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>
                      {token.balance}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600 }}>
                      {token.valueUsd > 0 ? formatCurrencyValue(token.valueUsd) : '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Active LP Positions */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Droplets size={18} color="var(--primary)" />
              <span>{language === 'ko' ? '내 유동성 포지션' : 'Active LP Positions'}</span>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('pools')}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <span>{language === 'ko' ? '풀 둘러보기' : 'Explore Pools'}</span>
                <ArrowUpRight size={13} />
              </button>
            )}
          </div>

          {userPositions.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Droplets size={32} color="var(--muted-foreground)" />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
                {language === 'ko' ? '활성 LP 포지션이 없습니다' : 'No Active LP Positions'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', maxWidth: 280 }}>
                {language === 'ko'
                  ? 'GIWA 풀에 유동성을 공급하여 0.05%~0.3% 거래 수수료를 획득하세요.'
                  : 'Deposit tokens into CLAMM or Stable pools on GIWA to earn trading fees.'}
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('pools')}
                  className="uniswap-btn-primary"
                  style={{ width: 'auto', padding: '8px 16px', fontSize: 12.5, borderRadius: 10, marginTop: 6 }}
                >
                  <PlusCircle size={14} />
                  <span>{language === 'ko' ? '유동성 공급하기' : 'Deposit Liquidity'}</span>
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {userPositions.map((pool) => (
                <div
                  key={pool.address}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'var(--secondary)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)' }}>
                      {pool.name}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', padding: '2px 6px', borderRadius: 6, background: 'var(--accent)' }}>
                      {pool.poolType} ({pool.feePercent})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-foreground)' }}>
                    <span>Pool Share: <strong style={{ color: 'var(--foreground)' }}>{pool.userPosition?.sharePercent}%</strong></span>
                    <span>Pool TVL: <strong style={{ color: 'var(--foreground)' }}>{formatCurrencyValue(pool.tvlUsd)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
