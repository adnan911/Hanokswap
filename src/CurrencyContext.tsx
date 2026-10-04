import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { fetchUsdKrwRate } from './lib/upbitKimchi';

export type Currency = 'KRW' | 'USD' | 'ETH';

export interface CurrencyRates {
  usdKrw: number;
  ethUsd: number;
  ethKrw: number;
}

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  toggleCurrency: () => void;
  rates: CurrencyRates;
  convertUSDToCurrency: (amountUSD: number, target?: Currency) => number;
  formatCurrencyValue: (amountUSD: number, target?: Currency) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    try {
      const saved = localStorage.getItem('hanok-currency');
      if (saved === 'KRW' || saved === 'USD' || saved === 'ETH') return saved;
      // Default to KRW if Korean locale detected
      if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ko')) {
        return 'KRW';
      }
    } catch {}
    return 'KRW';
  });

  const [rates, setRates] = useState<CurrencyRates>({
    usdKrw: 1400.0,
    ethUsd: 3150.0,
    ethKrw: 4410000.0,
  });

  useEffect(() => {
    let cancelled = false;
    async function updateRates() {
      try {
        const usdKrw = await fetchUsdKrwRate();
        if (!cancelled) {
          const ethUsd = 3150.0;
          setRates({
            usdKrw,
            ethUsd,
            ethKrw: ethUsd * usdKrw,
          });
        }
      } catch {}
    }
    updateRates();
    const timer = setInterval(updateRates, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem('hanok-currency', c);
    } catch {}
  };

  const toggleCurrency = () => {
    const list: Currency[] = ['KRW', 'USD', 'ETH'];
    const nextIdx = (list.indexOf(currency) + 1) % list.length;
    setCurrency(list[nextIdx]);
  };

  const convertUSDToCurrency = (amountUSD: number, target = currency): number => {
    if (target === 'USD') return amountUSD;
    if (target === 'KRW') return amountUSD * rates.usdKrw;
    if (target === 'ETH') return amountUSD / rates.ethUsd;
    return amountUSD;
  };

  const formatCurrencyValue = (amountUSD: number, target = currency): string => {
    const val = convertUSDToCurrency(amountUSD, target);
    if (target === 'KRW') {
      if (Math.abs(val) >= 100000000) {
        return `₩${(val / 100000000).toFixed(2)}억`;
      }
      if (Math.abs(val) >= 10000) {
        return `₩${(val / 10000).toFixed(1)}만`;
      }
      return `₩${val.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`;
    }
    if (target === 'USD') {
      return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (target === 'ETH') {
      return `Ξ${val.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
    }
    return `${val}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        toggleCurrency,
        rates,
        convertUSDToCurrency,
        formatCurrencyValue,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return ctx;
}
