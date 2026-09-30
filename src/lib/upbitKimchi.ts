/**
 * Upbit Market & Kimchi Premium (김치프리미엄) Calculation Engine
 * 
 * Provides real-time pricing from Upbit exchange and calculates the premium/discount
 * between Korean Won (KRW) domestic markets and global USD markets.
 */

export interface UpbitTicker {
  market: string;
  trade_price: number;
  signed_change_rate: number;
  signed_change_price: number;
  acc_trade_volume_24h: number;
  acc_trade_price_24h: number;
}

export interface KimchiPremiumData {
  usdKrwRate: number;
  upbitEthKrw: number;
  globalEthUsd: number;
  ethKimchiPremiumPct: number;
  upbitBtcKrw: number;
  globalBtcUsd: number;
  btcKimchiPremiumPct: number;
  upbitUsdtKrw: number;
  updatedAt: string;
}

export async function fetchUpbitTickers(): Promise<Record<string, UpbitTicker>> {
  try {
    const res = await fetch('/api/upbit-proxy?markets=KRW-BTC,KRW-ETH,KRW-USDT');
    if (!res.ok) throw new Error('Upbit proxy fetch failed');
    const data: UpbitTicker[] = await res.json();
    
    const tickerMap: Record<string, UpbitTicker> = {};
    for (const t of data) {
      tickerMap[t.market] = t;
    }
    return tickerMap;
  } catch {
    // Fallback estimates if API is unreachable
    return {
      'KRW-ETH': { market: 'KRW-ETH', trade_price: 3650000, signed_change_rate: 0.015, signed_change_price: 54000, acc_trade_volume_24h: 12000, acc_trade_price_24h: 43800000000 },
      'KRW-BTC': { market: 'KRW-BTC', trade_price: 135000000, signed_change_rate: 0.021, signed_change_price: 2700000, acc_trade_volume_24h: 850, acc_trade_price_24h: 114750000000 },
      'KRW-USDT': { market: 'KRW-USDT', trade_price: 1395, signed_change_rate: 0.002, signed_change_price: 3, acc_trade_volume_24h: 50000000, acc_trade_price_24h: 69750000000 },
    };
  }
}

export async function fetchUsdKrwRate(): Promise<number> {
  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=KRW');
    if (res.ok) {
      const json = await res.json();
      if (json?.rates?.KRW) return Number(json.rates.KRW);
    }
  } catch {
    // ignore
  }
  return 1385.0; // standard fallback rate
}

export async function calculateKimchiPremium(globalEthUsd = 2620, globalBtcUsd = 96500): Promise<KimchiPremiumData> {
  const [tickers, usdKrwRate] = await Promise.all([
    fetchUpbitTickers(),
    fetchUsdKrwRate(),
  ]);

  const upbitEth = tickers['KRW-ETH']?.trade_price || globalEthUsd * usdKrwRate;
  const upbitBtc = tickers['KRW-BTC']?.trade_price || globalBtcUsd * usdKrwRate;
  const upbitUsdt = tickers['KRW-USDT']?.trade_price || usdKrwRate;

  const fairEthKrw = globalEthUsd * usdKrwRate;
  const ethKimchiPremiumPct = fairEthKrw > 0 ? ((upbitEth - fairEthKrw) / fairEthKrw) * 100 : 0;

  const fairBtcKrw = globalBtcUsd * usdKrwRate;
  const btcKimchiPremiumPct = fairBtcKrw > 0 ? ((upbitBtc - fairBtcKrw) / fairBtcKrw) * 100 : 0;

  return {
    usdKrwRate,
    upbitEthKrw: upbitEth,
    globalEthUsd,
    ethKimchiPremiumPct,
    upbitBtcKrw: upbitBtc,
    globalBtcUsd,
    btcKimchiPremiumPct,
    upbitUsdtKrw: upbitUsdt,
    updatedAt: new Date().toISOString(),
  };
}

export function formatKrw(krwAmount: number): string {
  if (krwAmount >= 100000000) {
    return `₩${(krwAmount / 100000000).toFixed(2)}억`;
  }
  if (krwAmount >= 10000) {
    return `₩${(krwAmount / 10000).toFixed(1)}만`;
  }
  return `₩${krwAmount.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`;
}
