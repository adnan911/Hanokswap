import { useLanguage } from '../LanguageContext';
import { Globe } from 'lucide-react';

interface Props {
  compact?: boolean;
}

export default function LanguageToggle({ compact = false }: Props) {
  const { language, setLanguage } = useLanguage();

  if (compact) {
    return (
      <button
        onClick={() => setLanguage(language === 'en' ? 'ko' : 'en')}
        title={language === 'en' ? '한국어로 전환' : 'Switch to English'}
        aria-label="Toggle language"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 36,
          padding: '0 12px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--card)',
          color: 'var(--foreground)',
          fontSize: 12.5,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <Globe size={15} color="var(--primary)" />
        <span>{language === 'en' ? 'KO (한국어)' : 'EN (English)'}</span>
      </button>
    );
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: 3,
        borderRadius: 12,
        background: 'var(--muted)',
        border: '1px solid var(--border)',
      }}
    >
      <button
        onClick={() => setLanguage('en')}
        style={{
          padding: '4px 10px',
          borderRadius: 8,
          border: 'none',
          background: language === 'en' ? 'var(--card)' : 'transparent',
          color: language === 'en' ? 'var(--foreground)' : 'var(--muted-foreground)',
          fontSize: 12,
          fontWeight: language === 'en' ? 800 : 600,
          cursor: 'pointer',
          boxShadow: language === 'en' ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage('ko')}
        style={{
          padding: '4px 10px',
          borderRadius: 8,
          border: 'none',
          background: language === 'ko' ? 'var(--card)' : 'transparent',
          color: language === 'ko' ? 'var(--foreground)' : 'var(--muted-foreground)',
          fontSize: 12,
          fontWeight: language === 'ko' ? 800 : 600,
          cursor: 'pointer',
          boxShadow: language === 'ko' ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        한국어
      </button>
    </div>
  );
}
