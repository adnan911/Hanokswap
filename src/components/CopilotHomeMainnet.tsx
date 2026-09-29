import { useState, useEffect } from 'react';
import type { EIP1193Provider } from 'viem';
import { TokenIcon } from './TokenIcon';
import NetworkGuard from './NetworkGuard';
import { useIsMobile } from '../useIsMobile';
import { getFormattedMarketAnalysis } from '../marketData';
import {
  ArrowRight,
  Zap,
  Repeat,
  Coins,
  Droplet,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Bot,
  AlertTriangle,
  Copy,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import Sparkline from './Sparkline';
import { usePortfolio, money, type MainnetBalances } from './usePortfolio';
import { USDC_LOGO, EURC_LOGO } from './tokenLogos';
import { loadLifiDiamond, describeTx, counterpartOf, fetchActivity, type Tx } from './txUtils';
import { showToast } from '../toast';
import { useLanguage } from '../LanguageContext';

interface Props {
  address: string;
  balances: MainnetBalances;
  onNavigate: (tab: any) => void;
  provider?: EIP1193Provider;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const ANALYSIS_SECTION_HEADERS = new Set([
  'TIMEFRAME',
  'KEY LEVELS',
  'MULTI-TIMEFRAME INSIGHT',
  'WHAT TO WATCH',
  'Tokenomics',
  'Token Vesting & Unlocks',
  'PRICE STABILITY',
  'STABILITY NOTE',
  'Supply',
]);

function isAnalysisMessage(text: string): boolean {
  const firstLine = text.split('\n')[0] ?? '';
  return /TIMEFRAME|PRICE STABILITY/.test(text) && !firstLine.startsWith('Elimdeki');
}

function renderAnalysis(content: string) {
  const lines = content.split('\n');
  return (
    <div style={{ textAlign: 'left' }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (i === 0) return <div key={i} style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{line}</div>;
        if (i === 1 && line.startsWith('$')) return <div key={i} className="prism-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>{line}</div>;
        if (ANALYSIS_SECTION_HEADERS.has(trimmed)) return <div key={i} style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{trimmed}</div>;
        if (trimmed.startsWith('⚠️') || trimmed.startsWith('Warning')) return (
          <div key={i} style={{ marginTop: 6, fontSize: 11, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={13} color="var(--primary)" /> {line.replace(/^(?:⚠\uFE0F?|\s)+/u, '')}
          </div>
        );
        if (!trimmed) return <div key={i} style={{ height: 2 }} />;
        return <div key={i} style={{ fontSize: 12.5, color: 'var(--foreground)', lineHeight: 1.5 }}>{line}</div>;
      })}
    </div>
  );
}

export default function CopilotHomeMainnet({ address, balances, onNavigate, provider }: Props) {
  const isMobile = useIsMobile();
  const { t, language } = useLanguage();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [diamond, setDiamond] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);

  async function ask(question: string) {
    if (!question.trim() || asking) return;
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setAsking(true);
    try {
      const marketAnswer = await getFormattedMarketAnalysis(question);
      if (marketAnswer) {
        setMessages((prev) => [...prev, { role: 'assistant', content: marketAnswer }]);
        return;
      }
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          system: `You are HanokSwap's AI wallet and DeFi assistant on GIWA Sepolia Testnet. Keep answers concise under 3 sentences. Always respond in the language of the user (${language === 'ko' ? 'Korean' : 'English'}).`,
          messages: [{ role: 'user', content: `Balance: ${balances.usdc}\nQuestion: ${question}` }],
        }),
      });
      const dataRes = await response.json();
      const answer = dataRes.content?.[0]?.text ?? (language === 'ko' ? '응답을 생성할 수 없습니다.' : 'Could not generate a response.');
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: language === 'ko' ? 'Giwa Sepolia 테스트넷 0.2s Flashblocks DEX 및 토큰 생성기가 활성화되어 있습니다.' : 'Giwa Sepolia Testnet DEX with 0.2s Flashblocks and 1-click token deployer is live.' }]);
    } finally {
      setAsking(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    loadLifiDiamond().then((d) => { if (!cancelled) setDiamond(d); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setTxs((await fetchActivity(address, 'mainnet', 10)).slice(0, 4));
      } catch {
        /* leave defaults */
      } finally {
        setLoading(false);
      }
    }
    if (address) load();
  }, [address]);

  const { total, holdings, chartPoints, hasChart } = usePortfolio(address, balances);
  const owned = holdings.filter((d) => d.n > 0);
  const balancesLoading = balances.usdc === null;
  const isNew = !balancesLoading && owned.length === 0;

  const card = {
    background: 'var(--card)',
    backdropFilter: 'blur(20px)',
    border: '1px solid var(--border)',
    borderRadius: 22,
    boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
  } as const;

  const statusIcon = (s: string) =>
    s === 'ok' ? <CheckCircle2 size={18} color="var(--primary)" /> : s === 'error' ? <XCircle size={18} color="#EF4444" /> : <Clock size={18} color="var(--muted-foreground)" />;

  const primaryBtn = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 44,
    padding: '0 20px',
    border: 'none',
    borderRadius: 14,
    background: 'var(--primary)',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 6px 20px oklch(0.6724 0.1308 38.7559 / 0.35)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  } as const;

  const ghostBtn = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 44,
    padding: '0 18px',
    borderRadius: 14,
    background: 'var(--muted)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  } as const;

  const hero = (
    <section style={{
      ...card,
      padding: isMobile ? '1.5rem' : '2rem 2.25rem',
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr',
      gap: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '-30%', right: '-10%', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, oklch(0.6724 0.1308 38.7559 / 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: 'oklch(0.6724 0.1308 38.7559 / 0.12)', color: 'var(--primary)' }}>
            GIWA SEPOLIA TESTNET
          </span>
          <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} /> 0.2s Flashblocks
          </span>
        </div>

        <div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4 }}>{t.totalNetWorth}</div>
          <div className="prism-mono" style={{ fontSize: isMobile ? 36 : 46, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>
            {balancesLoading ? '…' : `$${money(total)}`}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 6 }}>
            {balancesLoading ? t.loading : `${owned.length} ${language === 'ko' ? '개 보유 자산' : 'assets'} · Giwa Sepolia L2`}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
          <button onClick={() => onNavigate('swap')} style={primaryBtn}>
            <Repeat size={15} /> {t.swap}
          </button>
          <button onClick={() => onNavigate('create-token')} style={ghostBtn}>
            <Coins size={15} color="var(--primary)" /> {t.createToken}
          </button>
          <button onClick={() => onNavigate('bridge')} style={ghostBtn}>
            <Zap size={15} /> {t.bridge}
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 16,
        padding: 20,
        borderRadius: 18,
        background: 'var(--muted)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
        minWidth: 0,
        position: 'relative',
        zIndex: 1,
      }}>
        {hasChart ? (
          <div>
            <Sparkline points={chartPoints} height={80} color="var(--primary)" />
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'right', marginTop: 4 }}>{chartPoints.length} {language === 'ko' ? '일간' : 'days'}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 700 }}>GIWA ECOSYSTEM</span>
            <span className="prism-mono" style={{ fontSize: 24, fontWeight: 800, color: 'var(--foreground)' }}>0.2s Finality</span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-foreground)' }}>
            <span>{language === 'ko' ? '추적 자산' : 'Assets Tracked'}</span>
            <span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{isNew ? '0' : balancesLoading ? '…' : owned.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--muted-foreground)' }}>
            <span>{language === 'ko' ? '네트워크' : 'Network'}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--foreground)', fontWeight: 700 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)' }} />
              GIWA Sepolia (91342)
            </span>
          </div>
        </div>
      </div>
    </section>
  );

  const quickActions = (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12 }}>
      {[
        { label: t.swap, sub: '0.2s Flashblocks', icon: Repeat, color: 'var(--primary)', tab: 'swap' },
        { label: t.createToken, sub: '1-Click ERC-20', icon: Coins, color: 'oklch(0.6898 0.1581 290.4107)', tab: 'create-token' },
        { label: t.pools, sub: 'CLAMM & Stable', icon: Droplet, color: '#10b981', tab: 'pools' },
        { label: t.bridge, sub: 'Free Faucet', icon: Zap, color: 'oklch(0.75 0.18 55)', tab: 'bridge' },
      ].map((item, idx) => {
        const Icon = item.icon;
        return (
          <button
            key={idx}
            onClick={() => onNavigate(item.tab)}
            style={{
              padding: '16px',
              borderRadius: 16,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}>
              <Icon size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>{item.label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{item.sub}</div>
            </div>
          </button>
        );
      })}
    </div>
  );

  const assets = (
    <section style={{ ...card, padding: isMobile ? '1.25rem' : 22, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h3 className="prism-display" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--foreground)' }}>{language === 'ko' ? '나의 자산' : 'Your Assets'}</h3>
          <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>{language === 'ko' ? 'Giwa Sepolia 보유 현황' : 'Giwa Sepolia Holdings'}</span>
        </div>
        <button onClick={() => onNavigate('bridge')} style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '5px 10px', color: 'var(--foreground)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Sparkles size={13} color="var(--primary)" /> {language === 'ko' ? '토큰 받기' : 'Faucet'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {balancesLoading && <div style={{ padding: '0.75rem 0', fontSize: 13, color: 'var(--muted-foreground)' }}>{t.loading}</div>}
        {owned.map((d) => (
          <div key={d.label} className="prism-asset-item"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderRadius: 14, background: 'var(--muted)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {d.label === 'USDC' || d.label === 'EURC'
                ? <img src={d.label === 'USDC' ? USDC_LOGO : EURC_LOGO} alt="" width={32} height={32} style={{ width: 32, height: 32, borderRadius: '50%' }} />
                : <TokenIcon symbol={d.label} size={32} />}
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>
                  {d.label}
                </div>
                <div className="prism-mono" style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>{d.amount} {d.label}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="prism-mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>
                {d.value !== null ? `$${money(d.value)}` : '—'}
              </div>
              <button onClick={() => onNavigate('swap')} title={`Swap ${d.label}`}
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Repeat size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const copilot = (
    <section style={{ ...card, padding: isMobile ? '1.25rem' : 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--muted)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bot size={16} color="var(--primary)" />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="ffh-ask" className="prism-display" style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>{t.copilotTitle}</label>
            <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>{t.copilotSubtitle}</span>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} title="Clear" style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <RefreshCw size={11} /> {language === 'ko' ? '초기화' : 'Clear'}
          </button>
        )}
      </div>

      {messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: m.role === 'user' ? '88%' : '100%',
              background: m.role === 'user' ? 'var(--primary)' : 'var(--muted)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)',
              borderRadius: 12,
              padding: '0.65rem 0.9rem',
              color: m.role === 'user' ? '#FFFFFF' : 'var(--foreground)',
              fontWeight: m.role === 'user' ? 700 : 500,
            }}>
              {m.role === 'assistant' && isAnalysisMessage(m.content) ? renderAnalysis(m.content) : <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>{m.content}</span>}
            </div>
          ))}
          {asking && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--primary)' }}>
              <span className="prism-live-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)' }} />
              {language === 'ko' ? 'Giwa 데이터를 분석 중입니다…' : 'Analyzing Giwa testnet data…'}
            </div>
          )}
        </div>
      )}

      {messages.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {t.sampleQuestions.slice(0, 3).map((q) => (
            <button key={q} onClick={() => ask(q)} disabled={asking}
              style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--muted)', fontSize: 12, color: 'var(--foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{q}</span>
              <ArrowRight size={12} color="var(--primary)" />
            </button>
          ))}
        </div>
      )}

      <div className="prism-ask-wrap" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', padding: '4px 4px 4px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--muted)' }}>
        <input id="ffh-ask" type="text" placeholder={t.askCopilotPlaceholder} value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') ask(input); }}
          disabled={asking}
          style={{ flex: 1, minWidth: 0, height: 32, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: 'var(--foreground)' }} />
        <button onClick={() => ask(input)} disabled={asking || !input.trim()} aria-label="Send"
          style={{ width: 32, height: 32, border: 'none', borderRadius: 8, background: 'var(--primary)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: asking || !input.trim() ? 'not-allowed' : 'pointer', opacity: asking || !input.trim() ? 0.5 : 1 }}>
          <Send size={13} />
        </button>
      </div>
    </section>
  );

  const activity = (
    <section style={{ ...card, padding: isMobile ? '1.25rem' : 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 className="prism-display" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--foreground)' }}>{t.recentActivity}</h3>
          <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>{language === 'ko' ? '온체인 검증 완료된 트랜잭션' : 'Verified on-chain executions'}</span>
        </div>
        <button onClick={() => onNavigate('history')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          {t.viewAll} <ArrowRight size={12} />
        </button>
      </div>
      {loading && <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', padding: '0.5rem 0' }}>{t.loading}</div>}
      {!loading && txs.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', padding: '0.5rem 0' }}>{language === 'ko' ? '최근 트랜잭션 내역이 없습니다.' : 'No recent transactions found for this address.'}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {txs.map((tx) => (
          <div key={tx.hash}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '0.75rem 0.9rem', borderRadius: 12, background: 'var(--muted)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {statusIcon(tx.status)}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--foreground)', fontWeight: 700 }}>{describeTx(tx, address, 'mainnet', diamond, true)}</div>
                <div className="prism-mono" style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{counterpartOf(tx, address)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>{tx.age}</span>
              <button onClick={() => { navigator.clipboard.writeText(tx.hash); showToast(t.addressCopied, 'success'); }} title="Copy hash"
                style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'var(--card)', color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Copy size={11} />
              </button>
              <a href={`https://sepolia-explorer.giwa.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" title="View on Explorer"
                style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'var(--card)', color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const twoCol = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'stretch' } as const;

  return (
    <div className="prism-home-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <NetworkGuard provider={provider} />
      {hero}
      {quickActions}
      <div style={twoCol}>
        {assets}
        {copilot}
      </div>
      {activity}
    </div>
  );
}
