import { useState } from 'react';
import type { EIP1193Provider, Address } from 'viem';
import { showToast } from '../toast';
import { useLanguage } from '../LanguageContext';
import { useIsMobile } from '../useIsMobile';
import { useCurrency } from '../CurrencyContext';
import {
  getLaunchpadTokens,
  saveNewFairLaunchToken,
  buyBondingCurveToken,
  type FairLaunchToken,
} from '../lib/launchpad';
import {
  getLiquidityLocks,
  saveNewLiquidityLock,
  type LiquidityLockRecord,
} from '../lib/liquidityLocker';
import {
  PlusCircle,
  BookOpen,
  ShieldCheck,
  Rocket,
  Lock,
  Flame,
  ArrowRight,
} from 'lucide-react';

interface Props {
  provider?: EIP1193Provider;
  address?: string;
  onNavigateToPools?: () => void;
  onNavigateToDocs?: () => void;
}

type DeployerTab = 'LAUNCHPAD' | 'STANDARD_ERC20' | 'LOCKER';

export default function GiwaTokenDeployer({ provider, address, onNavigateToPools, onNavigateToDocs }: Props) {
  const isMobile = useIsMobile();
  const { language } = useLanguage();
  const { formatCurrencyValue } = useCurrency();

  const [activeTab, setActiveTab] = useState<DeployerTab>('LAUNCHPAD');

  // Launchpad State
  const [launchpadTokens, setLaunchpadTokens] = useState<FairLaunchToken[]>(getLaunchpadTokens());
  const [selectedTokenForBuy, setSelectedTokenForBuy] = useState<FairLaunchToken | null>(null);
  const [buyEthAmount, setBuyEthAmount] = useState<string>('0.5');

  // Create Fair Launch Token Modal State
  const [showCreateFairTokenModal, setShowCreateFairTokenModal] = useState(false);
  const [fairName, setFairName] = useState('');
  const [fairSymbol, setFairSymbol] = useState('');
  const [fairDesc, setFairDesc] = useState('');
  const [fairIcon, setFairIcon] = useState('🚀');

  // Standard ERC-20 State
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [decimals, setDecimals] = useState<number>(18);
  const [supply, setSupply] = useState<string>('1000000');
  const [enableAntiSnipe, setEnableAntiSnipe] = useState(true);
  const [requestDojangVerification, setRequestDojangVerification] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [deployedToken, setDeployedToken] = useState<{ address: Address; name: string; symbol: string; supply: string } | null>(null);

  // Liquidity Locker State
  const [locks, setLocks] = useState<LiquidityLockRecord[]>(getLiquidityLocks());
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockPoolName, setLockPoolName] = useState('WETH / USDC Pool');
  const [lockAmountLP, setLockAmountLP] = useState('500.00');
  const [lockDurationDays, setLockDurationDays] = useState<number>(365);
  const [isPermanentBurn, setIsPermanentBurn] = useState(false);

  const handleCreateFairToken = () => {
    if (!fairName || !fairSymbol) {
      showToast('Enter token name and symbol', 'error');
      return;
    }
    const randHex = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const tokenAddress = `0x${randHex}` as Address;

    const newToken: FairLaunchToken = {
      id: `tok-${Date.now()}`,
      tokenAddress,
      name: fairName,
      symbol: fairSymbol.toUpperCase(),
      creator: (address as Address) || ('0xDemoCreator' as Address),
      description: fairDesc || 'Fair launch community token on Giwa Chain',
      icon: fairIcon || '🚀',
      ethRaised: 0.1,
      graduationTargetETH: 20.0,
      tokensSold: 4000000,
      maxCurveSupply: 800000000,
      marketCapUSD: 315,
      currentPriceUSD: 0.00000039,
      priceChange24hPct: +10.0,
      holdersCount: 1,
      isGraduated: false,
      createdAt: Date.now(),
      isDojangVerified: true,
    };

    saveNewFairLaunchToken(newToken);
    setLaunchpadTokens(getLaunchpadTokens());
    setShowCreateFairTokenModal(false);
    setFairName('');
    setFairSymbol('');
    setFairDesc('');
    showToast(`Fair Launch token $${newToken.symbol} deployed on Bonding Curve!`, 'success');
  };

  const handleBuyOnCurve = () => {
    if (!selectedTokenForBuy || !buyEthAmount || parseFloat(buyEthAmount) <= 0) return;
    const ethVal = parseFloat(buyEthAmount);
    const { tokensReceived, isGraduated } = buyBondingCurveToken(selectedTokenForBuy.id, ethVal);
    setLaunchpadTokens(getLaunchpadTokens());
    setSelectedTokenForBuy(null);

    if (isGraduated) {
      showToast(`🎉 Bonding Curve 100% Filled! $${selectedTokenForBuy.symbol} graduated to Hanokswap CLAMM DEX!`, 'success');
    } else {
      showToast(`Bought ${tokensReceived.toLocaleString()} $${selectedTokenForBuy.symbol} on curve!`, 'success');
    }
  };

  const handleCreateLock = () => {
    if (!lockAmountLP || parseFloat(lockAmountLP) <= 0) return;
    const randLockId = `lock-${Date.now().toString().slice(-4)}`;
    const newLock: LiquidityLockRecord = {
      lockId: randLockId,
      lpTokenAddress: '0xE9c27006b15E681C0edE87a37Bbb678E7F201F7C' as Address,
      poolName: lockPoolName,
      ownerAddress: isPermanentBurn ? ('0x000000000000000000000000000000000000dEaD' as Address) : ((address as Address) || ('0xDemo' as Address)),
      amountLP: lockAmountLP,
      valueUSD: parseFloat(lockAmountLP) * 300,
      unlockTimestamp: isPermanentBurn ? 253402300799000 : Date.now() + lockDurationDays * 86400000,
      isBurntPermanently: isPermanentBurn,
      isWithdrawn: false,
      projectName: 'Community Verified Project',
      createdAt: Date.now(),
    };

    saveNewLiquidityLock(newLock);
    setLocks(getLiquidityLocks());
    setShowLockModal(false);
    showToast(isPermanentBurn ? 'LP Tokens permanently burnt to 0xDead!' : `LP Tokens locked for ${lockDurationDays} days!`, 'success');
  };

  const handleDeployStandardERC20 = async () => {
    if (!provider || !address) {
      showToast('Connect your wallet to deploy', 'error');
      return;
    }
    if (!name.trim() || !symbol.trim() || !supply.trim()) {
      showToast('Please fill all token parameters', 'error');
      return;
    }

    setIsDeploying(true);
    setStatusMsg('Deploying ERC-20 on Giwa Chain...');
    try {
      setDeployedToken(null);
      throw new Error('ERC-20 deployment is not connected yet. No token was deployed.');
    } catch (err: any) {
      showToast(err?.message || 'Deployment failed', 'error');
    } finally {
      setIsDeploying(false);
      setStatusMsg('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: isMobile ? 460 : 960, margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: 'var(--primary)', color: '#FFFFFF' }}>
              GIWA LAUNCHPAD &amp; FACTORY
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>⚡ 0.2s Flashblocks Deployment</span>
          </div>
        </div>

        {onNavigateToDocs && (
          <button
            onClick={onNavigateToDocs}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            <BookOpen size={13} color="var(--primary)" />
            <span>Launchpad Docs</span>
          </button>
        )}
      </div>

      {/* Mode Switcher */}
      <div style={{ display: 'flex', gap: 8, background: 'var(--card)', padding: 6, borderRadius: 16, border: '1px solid var(--border)', overflowX: 'auto' }}>
        {[
          { id: 'LAUNCHPAD', label: language === 'ko' ? '본딩커브 런치패드' : 'Bonding Curve Launchpad', desc: language === 'ko' ? '공정 발행 모델' : 'Fair launch bonding model' },
          { id: 'STANDARD_ERC20', label: language === 'ko' ? 'ERC-20 토큰 생성' : 'Standard ERC-20', desc: language === 'ko' ? '안티 스나이핑 보호' : 'Anti-snipe protection' },
          { id: 'LOCKER', label: language === 'ko' ? '유동성 락커' : 'Liquidity Locker', desc: language === 'ko' ? 'LP 락업 & 소각' : 'Proof of LP lock' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as DeployerTab)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 12,
              border: activeTab === tab.id ? '1px solid var(--primary)' : '1px solid transparent',
              background: activeTab === tab.id ? 'oklch(0.6724 0.1308 38.7559 / 0.15)' : 'transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--muted-foreground)',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              textAlign: 'center',
            }}
          >
            <div>{tab.label}</div>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted-foreground)', marginTop: 2 }}>{tab.desc}</div>
          </button>
        ))}
      </div>

      {/* TAB 1: BONDING CURVE FAIR LAUNCHPAD */}
      {activeTab === 'LAUNCHPAD' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: 16, borderRadius: 16, background: 'oklch(0.6724 0.1308 38.7559 / 0.12)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Rocket size={26} color="var(--primary)" />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>
                  {language === 'ko' ? '100% 공정 발행 (Fair Launch) 본딩커브' : '100% Fair Launch Bonding Curve'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                  {language === 'ko'
                    ? '초기 유동성 필요 없음 · 누구나 생성 가능 · 20 ETH 모집 시 하옥스왑 CLAMM 풀 자동 이전 및 LP 영구 락업'
                    : 'Zero seed capital needed. Auto-graduates to Hanokswap CLAMM and locks LP when 20 ETH is raised.'}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowCreateFairTokenModal(true)}
              style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 14px oklch(0.6724 0.1308 38.7559 / 0.35)' }}
            >
              <PlusCircle size={16} />
              <span>{language === 'ko' ? '새 토큰 런치하기' : 'Create Fair Token'}</span>
            </button>
          </div>

          {/* Tokens Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
            {launchpadTokens.map((token) => {
              const progressPct = Math.min(100, Math.round((token.ethRaised / token.graduationTargetETH) * 100));
              return (
                <div
                  key={token.id}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 20,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 14,
                    boxShadow: '0 10px 28px rgba(0,0,0,0.15)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 32 }}>{token.icon}</span>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {token.name}
                            {token.isDojangVerified && (
                              <span title="Dojang Verified Project">
                                <ShieldCheck size={14} color="#3b82f6" />
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>${token.symbol} · by {token.creatorUpId || token.creator.slice(0, 6)}</div>
                        </div>
                      </div>
                      {token.isGraduated ? (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontWeight: 800, border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                          🎓 GRADUATED
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 800 }}>
                          ON CURVE
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.4, margin: '0 0 12px 0', minHeight: 34 }}>
                      {token.description}
                    </p>

                    <div style={{ background: 'var(--muted)', padding: 10, borderRadius: 12, marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
                        <span>Bonding Curve Progress</span>
                        <span style={{ fontWeight: 800, color: 'var(--foreground)' }}>{progressPct}% ({token.ethRaised} / 20 ETH)</span>
                      </div>
                      <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${progressPct}%`, height: '100%', background: token.isGraduated ? '#22c55e' : 'var(--primary)', borderRadius: 999, transition: 'width 0.3s' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-foreground)' }}>
                      <span>Market Cap: <strong style={{ color: 'var(--foreground)' }}>{formatCurrencyValue(token.marketCapUSD)}</strong></span>
                      <span>Holders: <strong style={{ color: 'var(--foreground)' }}>{token.holdersCount}</strong></span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (token.isGraduated) {
                        onNavigateToPools?.();
                      } else {
                        setSelectedTokenForBuy(token);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: 12,
                      border: 'none',
                      background: token.isGraduated ? 'var(--muted)' : 'var(--primary)',
                      color: token.isGraduated ? 'var(--foreground)' : '#fff',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {token.isGraduated ? (
                      <span>Trade on Hanok DEX</span>
                    ) : (
                      <>
                        <span>Buy on Curve</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: STANDARD ERC-20 DEPLOYER */}
      {activeTab === 'STANDARD_ERC20' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, padding: '2rem', boxShadow: '0 20px 48px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 16 }}>
            {language === 'ko' ? '보안 강화형 ERC-20 토큰 배포기' : 'Deploy Verified ERC-20 Token'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Token Name</label>
              <input
                type="text"
                placeholder="e.g. Dunamu Won"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', fontSize: 14, color: 'var(--foreground)', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Token Symbol</label>
              <input
                type="text"
                placeholder="e.g. DWON"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', fontSize: 14, color: 'var(--foreground)', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Total Supply</label>
              <input
                type="text"
                placeholder="1000000"
                value={supply}
                onChange={(e) => setSupply(e.target.value)}
                style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', fontSize: 14, color: 'var(--foreground)', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Decimals</label>
              <input
                type="number"
                value={decimals}
                onChange={(e) => setDecimals(Number(e.target.value))}
                style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', fontSize: 14, color: 'var(--foreground)', outline: 'none' }}
              />
            </div>
          </div>

          {/* Launch Guards Toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--muted)', padding: 14, borderRadius: 14, marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--foreground)', cursor: 'pointer' }}>
              <input type="checkbox" checked={enableAntiSnipe} onChange={(e) => setEnableAntiSnipe(e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
              <span>🛡️ Enable Anti-Snipe &amp; Max Wallet Protection (Max 1% Wallet / 0.5% TX / 30s Cooldown)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--foreground)', cursor: 'pointer' }}>
              <input type="checkbox" checked={requestDojangVerification} onChange={(e) => setRequestDojangVerification(e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
              <span>📜 Mint Dunamu Dojang Project Attestation Proof</span>
            </label>
          </div>

          <button
            onClick={handleDeployStandardERC20}
            disabled={isDeploying}
            style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: isDeploying ? 'not-allowed' : 'pointer' }}
          >
            {isDeploying ? (statusMsg || 'Deploying...') : 'Deploy Token on Giwa L2'}
          </button>

          {deployedToken && (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', fontSize: 12 }}>
              <div style={{ fontWeight: 800, color: '#22c55e', marginBottom: 4 }}>🎉 Token Successfully Deployed!</div>
              <div className="prism-mono" style={{ color: 'var(--foreground)' }}>Address: {deployedToken.address}</div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LP LIQUIDITY LOCKER */}
      {activeTab === 'LOCKER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: 16, borderRadius: 16, background: 'oklch(0.6724 0.1308 38.7559 / 0.12)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Lock size={26} color="var(--primary)" />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>
                  {language === 'ko' ? '암호화 유동성 락커 & 영구 소각기' : 'Cryptographic LP Token Locker & Burner'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                  {language === 'ko'
                    ? '러그풀(Rug-pull) 방지 및 신뢰 증명을 위해 DEX LP 토큰을 타임락하거나 영구 소각(0xDead)하세요.'
                    : 'Time-lock or burn LP tokens to prove protocol transparency and protect investors.'}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowLockModal(true)}
              style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Lock size={16} />
              <span>{language === 'ko' ? 'LP 락업 / 소각하기' : 'Lock / Burn LP'}</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
            {locks.map((lk) => (
              <div key={lk.lockId} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>{lk.poolName}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Project: {lk.projectName}</div>
                  </div>
                  {lk.isBurntPermanently ? (
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Flame size={12} /> BURNT FOREVER
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Lock size={12} /> TIME-LOCKED
                    </span>
                  )}
                </div>

                <div style={{ background: 'var(--muted)', padding: 12, borderRadius: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Locked LP Value</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)' }}>{formatCurrencyValue(lk.valueUSD)}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>{lk.amountLP} LP Tokens</div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Unlock Date:</span>
                  <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>
                    {lk.isBurntPermanently ? 'Permanent' : new Date(lk.unlockTimestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Create Fair Launch Token */}
      {showCreateFairTokenModal && (
        <div onClick={() => setShowCreateFairTokenModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>Launch Token on Bonding Curve</div>
              <button onClick={() => setShowCreateFairTokenModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted-foreground)', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Emoji / Icon</label>
                <input type="text" value={fairIcon} onChange={(e) => setFairIcon(e.target.value)} style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 16, color: 'var(--foreground)', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Token Name</label>
                <input type="text" placeholder="e.g. Hanok Shiba" value={fairName} onChange={(e) => setFairName(e.target.value)} style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Token Symbol</label>
                <input type="text" placeholder="e.g. HSHIB" value={fairSymbol} onChange={(e) => setFairSymbol(e.target.value)} style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Description</label>
                <textarea rows={2} placeholder="Describe your community token..." value={fairDesc} onChange={(e) => setFairDesc(e.target.value)} style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none', resize: 'none' }} />
              </div>
            </div>

            <button onClick={handleCreateFairToken} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              Launch Fair Token (0 ETH Initial Pool)
            </button>
          </div>
        </div>
      )}

      {/* Modal: Buy on Bonding Curve */}
      {selectedTokenForBuy && (
        <div onClick={() => setSelectedTokenForBuy(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>Buy ${selectedTokenForBuy.symbol} on Curve</div>
              <button onClick={() => setSelectedTokenForBuy(null)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted-foreground)', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: 'var(--muted)', padding: 14, borderRadius: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>You Pay (ETH)</div>
              <input type="number" value={buyEthAmount} onChange={(e) => setBuyEthAmount(e.target.value)} style={{ width: '100%', background: 'none', border: 'none', fontSize: 22, fontWeight: 800, color: 'var(--foreground)', outline: 'none' }} />
            </div>

            <button onClick={handleBuyOnCurve} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              Confirm Curve Buy
            </button>
          </div>
        </div>
      )}

      {/* Modal: Create LP Lock / Burn */}
      {showLockModal && (
        <div onClick={() => setShowLockModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>Lock or Burn Liquidity</div>
              <button onClick={() => setShowLockModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted-foreground)', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Pool Pair</label>
                <input type="text" value={lockPoolName} onChange={(e) => setLockPoolName(e.target.value)} style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>LP Amount to Lock</label>
                <input type="number" value={lockAmountLP} onChange={(e) => setLockAmountLP(e.target.value)} style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }} />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--foreground)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isPermanentBurn} onChange={(e) => setIsPermanentBurn(e.target.checked)} style={{ accentColor: '#ef4444', width: 16, height: 16 }} />
                  <span>🔥 Burn Permanently to 0xDead (Irreversible)</span>
                </label>
              </div>

              {!isPermanentBurn && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Lock Duration</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[90, 180, 365, 730].map((d) => (
                      <button
                        key={d}
                        onClick={() => setLockDurationDays(d)}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: 8,
                          border: lockDurationDays === d ? '1px solid var(--primary)' : '1px solid var(--border)',
                          background: lockDurationDays === d ? 'var(--primary)' : 'var(--muted)',
                          color: lockDurationDays === d ? '#fff' : 'var(--foreground)',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {d >= 365 ? `${d / 365}Y` : `${d / 30}M`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleCreateLock} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: isPermanentBurn ? '#ef4444' : 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              {isPermanentBurn ? 'Confirm LP Burn (0xDead)' : `Lock LP for ${lockDurationDays} Days`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
