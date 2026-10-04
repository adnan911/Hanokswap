import { useState, useRef, useEffect } from 'react';
import { useCurrency, type Currency } from '../CurrencyContext';
import { ChevronDown } from 'lucide-react';

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const CURRENCY_LIST: { id: Currency; label: string; symbol: string; desc: string }[] = [
    { id: 'KRW', label: 'KRW (₩)', symbol: '₩', desc: '대한민국 원' },
    { id: 'USD', label: 'USD ($)', symbol: '$', desc: '미국 달러' },
    { id: 'ETH', label: 'ETH (Ξ)', symbol: 'Ξ', desc: '이더리움' },
  ];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const active = CURRENCY_LIST.find((c) => c.id === currency) || CURRENCY_LIST[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 10,
          background: 'var(--muted)',
          border: '1px solid var(--border)',
          color: 'var(--foreground)',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <span style={{ color: 'var(--primary)' }}>{active.symbol}</span>
        <span>{active.id}</span>
        <ChevronDown size={13} style={{ color: 'var(--muted-foreground)' }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 150,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 4,
            boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {CURRENCY_LIST.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCurrency(c.id);
                setIsOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 8,
                background: currency === c.id ? 'var(--muted)' : 'transparent',
                border: 'none',
                color: currency === c.id ? 'var(--primary)' : 'var(--foreground)',
                fontSize: 12,
                fontWeight: currency === c.id ? 800 : 600,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span>{c.label}</span>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{c.symbol}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
