import { useState } from 'react';
import type { EIP1193Provider } from 'viem';
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  erc20Abi,
  parseUnits,
  parseAbi,
  type Address,
} from 'viem';
import { giwaSepolia, GIWA_STANDARD_RPC } from '../chains';
import { useGiwaPools, type GiwaPoolData } from '../hooks/useGiwaPools';
import { useIsMobile } from '../useIsMobile';
import { useLanguage } from '../LanguageContext';
import { useCurrency } from '../CurrencyContext';
import { TokenIcon } from './TokenIcon';
import { showToast } from '../toast';
import { waitForSuccess } from '../txHelpers';
import {
  getALMVaults,
  saveALMVaultDeposit,
  type ALMVaultData,
} from '../lib/alm';
import {
  getUserVeHanokProfile,
  saveUserVeHanokLock,
  getPoolGauges,
  voteOnGauge,
  type PoolGauge,
  type UserVeHanokProfile,
} from '../lib/veHanok';
import {
  getMultiRewardFarms,
  claimAllFarmRewards,
  type MultiRewardFarmData,
} from '../lib/farming';
import {
  TrendingUp,
  Droplet,
  BarChart3,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Lock,
  Vote,
  Award,
  ArrowRight,
} from 'lucide-react';

interface Props {
  provider?: EIP1193Provider;
  address?: string;
  onRefresh?: () => void;
}

type YieldSection = 'POOLS' | 'ALM' | 'VE_HANOK' | 'FARMS';

const STABLE_POOL_ABI = parseAbi([
  'function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount) external returns (uint256)',
  'function remove_liquidity(uint256 _amount, uint256[2] memory min_amounts) external returns (uint256[2] memory)',
]);

export default function LiquidityPools({ provider, address, onRefresh }: Props) {
  const isMobile = useIsMobile();
  const { t, language } = useLanguage();
  const { formatCurrencyValue } = useCurrency();
  const { pools, loading, refresh } = useGiwaPools(provider, address);

  const [activeSection, setActiveSection] = useState<YieldSection>('POOLS');
  const [expandedPool, setExpandedPool] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'CLAMM' | 'STABLE'>('all');
  const [search, setSearch] = useState('');

  // ALM state
  const [almVaults, setAlmVaults] = useState<ALMVaultData[]>(getALMVaults());
  const [selectedVault, setSelectedVault] = useState<ALMVaultData | null>(null);
  const [almDepositAmount, setAlmDepositAmount] = useState<string>('500');

  // veHANOK & Gauge state
  const [veProfile, setVeProfile] = useState<UserVeHanokProfile>(getUserVeHanokProfile(address));
  const [lockAmount, setLockAmount] = useState<string>('500');
  const [lockWeeks, setLockWeeks] = useState<number>(104); // 2 years default
  const [gauges, setGauges] = useState<PoolGauge[]>(getPoolGauges());

  // Farms state
  const [farms, setFarms] = useState<MultiRewardFarmData[]>(getMultiRewardFarms());

  // Total Protocol Stats
  const totalTvl = pools.reduce((acc, p) => acc + p.tvlUsd, 0);
  const totalVolume24h = pools.reduce((acc, p) => acc + p.volume24hUsd, 0);

  const filteredPools = pools
    .filter((p) => filter === 'all' || p.poolType === filter)
    .filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.address.toLowerCase().includes(search.toLowerCase())
    );

  const handleRefresh = () => {
    refresh();
    setAlmVaults(getALMVaults());
    setVeProfile(getUserVeHanokProfile(address));
    setGauges(getPoolGauges());
    setFarms(getMultiRewardFarms());
    if (onRefresh) onRefresh();
    showToast(t.poolsRefreshed, 'success');
  };

  const handleCreateLock = () => {
    if (!lockAmount || parseFloat(lockAmount) <= 0) {
      showToast('Enter valid HANOK lock amount', 'error');
      return;
    }
    saveUserVeHanokLock(lockAmount, lockWeeks);
    setVeProfile(getUserVeHanokProfile(address));
    showToast(`Locked ${lockAmount} HANOK for ${lockWeeks} weeks! veHANOK minted.`, 'success');
    setLockAmount('');
  };

  const handleVote = (gaugeId: string, weightPct: number) => {
    voteOnGauge(gaugeId, weightPct);
    setGauges(getPoolGauges());
    showToast(`Simulated ${weightPct}% gauge vote locally. No on-chain vote was submitted.`, 'info');
  };

  const handleClaimFarm = (farmId: string) => {
    const claimedUSD = claimAllFarmRewards(farmId);
    setFarms(getMultiRewardFarms());
    showToast(`Claimed multi-rewards (~$${claimedUSD.toFixed(2)}) successfully!`, 'success');
  };

  const handleAlmDeposit = () => {
    if (!selectedVault || !almDepositAmount || parseFloat(almDepositAmount) <= 0) return;
    const val = parseFloat(almDepositAmount);
    saveALMVaultDeposit(selectedVault.id, (val / 10).toFixed(4), val);
    setAlmVaults(getALMVaults());
    setSelectedVault(null);
    showToast(`Deposited $${val.toLocaleString()} into ${selectedVault.name}!`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: isMobile ? 460 : 960, margin: '0 auto' }}>
      {/* Top Banner & Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'var(--primary)', color: '#FFFFFF' }}>
              {t.giwaSepoliaDex}
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{t.flashblocksEnabled}</span>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          title="Refresh on-chain reserves"
          style={{
            height: 38,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 16px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--foreground)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} /> {t.refresh}
        </button>
      </div>

      {/* Aggregate Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t.tvl}</div>
            <div className="prism-mono" style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: 'var(--foreground)', marginTop: 4 }}>
              {formatCurrencyValue(totalTvl)}
            </div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={20} color="var(--primary)" />
          </div>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t.activePools}</div>
            <div className="prism-mono" style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: 'var(--foreground)', marginTop: 4 }}>
              {pools.length}
            </div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Droplet size={20} color="var(--primary)" />
          </div>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{t.volume24h}</div>
            <div className="prism-mono" style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: 'var(--foreground)', marginTop: 4 }}>
              {formatCurrencyValue(totalVolume24h)}
            </div>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={20} color="var(--primary)" />
          </div>
        </div>
      </div>

      {/* Yield Architecture Mode Switcher */}
      <div style={{ display: 'flex', gap: 8, background: 'var(--card)', padding: 6, borderRadius: 16, border: '1px solid var(--border)', overflowX: 'auto' }}>
        {[
          { id: 'POOLS', label: language === 'ko' ? '유동성 풀' : 'Pools', desc: 'CLAMM & Stableswap' },
          { id: 'ALM', label: language === 'ko' ? '자동화 금고' : 'Auto-Vaults', desc: language === 'ko' ? 'ALM 동적 리밸런싱' : 'Dynamic rebalancing' },
          { id: 'VE_HANOK', label: language === 'ko' ? 'veHANOK 거버넌스' : 'veHANOK Gauges', desc: language === 'ko' ? '주간 투표 및 부스트' : 'Vote & boost yield' },
          { id: 'FARMS', label: language === 'ko' ? '슈퍼팜' : 'Superfarms', desc: language === 'ko' ? '멀티 토큰 리워드' : 'Multi-token rewards' },
        ].map((sec) => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id as YieldSection)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 12,
              border: activeSection === sec.id ? '1px solid var(--primary)' : '1px solid transparent',
              background: activeSection === sec.id ? 'oklch(0.6724 0.1308 38.7559 / 0.15)' : 'transparent',
              color: activeSection === sec.id ? 'var(--primary)' : 'var(--muted-foreground)',
              fontWeight: 800,
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              textAlign: 'center',
            }}
          >
            <div>{sec.label}</div>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted-foreground)', marginTop: 2 }}>{sec.desc}</div>
          </button>
        ))}
      </div>

      {/* SECTION 1: CLASSIC POOLS */}
      {activeSection === 'POOLS' && (
        <>
          {/* Filter Tabs & Search */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
              {(['all', 'CLAMM', 'STABLE'] as const).map((tabKey) => (
                <button
                  key={tabKey}
                  onClick={() => setFilter(tabKey)}
                  style={{
                    flex: isMobile ? 1 : undefined,
                    padding: '0.4rem 1.1rem',
                    borderRadius: 9,
                    border: 'none',
                    background: filter === tabKey ? 'var(--primary)' : 'transparent',
                    color: filter === tabKey ? '#FFFFFF' : 'var(--muted-foreground)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {tabKey === 'all' ? t.allPools : tabKey === 'CLAMM' ? t.concentratedClamm : t.stableswap}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder={t.searchPools}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: isMobile ? '100%' : 260,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '0.6rem 0.9rem',
                fontSize: 13,
                color: 'var(--foreground)',
                outline: 'none',
              }}
            />
          </div>

          {/* Pools List */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '1rem 1.4rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>{t.poolsTitle}</div>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{filteredPools.length} Pools</span>
            </div>

            {!isMobile && (
              <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.2fr 1.2fr 1fr 100px', gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.5px' }}>{t.poolPair}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.5px' }}>{t.protocolType}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.5px', textAlign: 'right' }}>{t.tvlReserves}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.5px', textAlign: 'right' }}>{t.estApy}</div>
                <div />
              </div>
            )}

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 14 }}>
                Syncing live on-chain pool metrics from Giwa Sepolia...
              </div>
            ) : filteredPools.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 14 }}>
                No liquidity pools matched your query.
              </div>
            ) : (
              filteredPools.map((pool) => (
                <PoolRow
                  key={pool.address}
                  pool={pool}
                  isExpanded={expandedPool === pool.address}
                  onToggle={() => setExpandedPool(expandedPool === pool.address ? null : pool.address)}
                  provider={provider}
                  userAddress={address}
                  onSuccess={refresh}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* SECTION 2: ALM AUTO-VAULTS */}
      {activeSection === 'ALM' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: 16, borderRadius: 16, background: 'oklch(0.6724 0.1308 38.7559 / 0.12)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Zap size={24} color="var(--primary)" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>
                {language === 'ko' ? '자동 집중 유동성 관리 금고 (ALM Vaults)' : 'Automated Liquidity Management Vaults'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                {language === 'ko'
                  ? '수동 틱 범위 조정 없이 알고리즘이 24/7 최적의 가격 범위로 자동 리밸런싱 및 수수료 자동 복리(Auto-Compounding)를 실행합니다.'
                  : 'Automated 24/7 concentrated liquidity rebalancing and auto-compounding without manual tick management.'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
            {almVaults.map((vault) => (
              <div key={vault.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 24 }}>{vault.token0.icon}{vault.token1.icon}</span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>{vault.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{vault.symbol}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontWeight: 800, border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                      {vault.rangeStatus}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, background: 'var(--muted)', padding: 12, borderRadius: 14, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Total APY</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{vault.totalApyPct}%</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Vault TVL</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>{formatCurrencyValue(vault.tvlUSD)}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Fee APR / Farm APR:</span>
                      <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{vault.feeApyPct}% / {vault.farmAprPct}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Rebalances Executed:</span>
                      <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{vault.rebalanceCount} times</span>
                    </div>
                    {vault.userShares && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary)', fontWeight: 700, marginTop: 4 }}>
                        <span>My Deposit:</span>
                        <span>{vault.userShares} Shares (${vault.userValueUSD?.toLocaleString()})</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedVault(vault)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <span>1-Click Deposit</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: veHANOK & GAUGE VOTING */}
      {activeSection === 'VE_HANOK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* veHANOK Lock Terminal */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Lock size={22} color="var(--primary)" />
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>
                  {language === 'ko' ? 'veHANOK 락업 스테이킹 (ve(3,3))' : 'veHANOK Voting Escrow Lock'}
                </div>
              </div>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, background: 'var(--muted)', color: 'var(--primary)', fontWeight: 700 }}>
                MAX 4 YEARS
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'var(--muted)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>보유 HANOK</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>{veProfile.hanokBalance} HANOK</div>
              </div>
              <div style={{ background: 'var(--muted)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>나의 veHANOK 파워</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>{veProfile.veHanokBalance} veHANOK</div>
              </div>
              <div style={{ background: 'var(--muted)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>락업 만료일</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{new Date(veProfile.unlockTimestamp).toLocaleDateString()}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>
                  <span>락업할 HANOK 수량</span>
                  <span>{lockWeeks}주 ({(lockWeeks / 52).toFixed(1)}년)</span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="number"
                    value={lockAmount}
                    onChange={(e) => setLockAmount(e.target.value)}
                    placeholder="0.0"
                    style={{ flex: 1, background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', fontSize: 15, fontWeight: 700, color: 'var(--foreground)', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[26, 52, 104, 208].map((w) => (
                      <button
                        key={w}
                        onClick={() => setLockWeeks(w)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: lockWeeks === w ? '1px solid var(--primary)' : '1px solid var(--border)',
                          background: lockWeeks === w ? 'var(--primary)' : 'var(--muted)',
                          color: lockWeeks === w ? '#fff' : 'var(--foreground)',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {w / 52}Y
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreateLock}
                style={{ padding: '12px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
              >
                {language === 'ko' ? 'HANOK 락업 & veHANOK 수령하기' : 'Lock HANOK & Mint veHANOK'}
              </button>
            </div>
          </div>

          {/* Weekly Gauge Voting Terminal */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Vote size={22} color="var(--primary)" />
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>
                  {language === 'ko' ? '주간 풀 인센티브 게이지 투표' : 'Weekly Pool Emission Gauge Voting'}
                </div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Epoch Ends in 3d 14h</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {gauges.map((g) => (
                <div key={g.id} style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>{g.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', gap: 12, marginTop: 4 }}>
                      <span>전체 득표율: <strong style={{ color: 'var(--primary)' }}>{g.currentVoteWeightPct}%</strong></span>
                      <span>주간 발행량: {g.weeklyEmissionsHANOK.toLocaleString()} HANOK</span>
                      <span>Bribes: ${g.bribesUSD.toLocaleString()}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    {[20, 50, 100].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => handleVote(g.id, pct)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: g.userVotedWeightPct === pct ? '1px solid var(--primary)' : '1px solid var(--border)',
                          background: g.userVotedWeightPct === pct ? 'var(--primary)' : 'var(--card)',
                          color: g.userVotedWeightPct === pct ? '#fff' : 'var(--foreground)',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {pct}% Vote
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: MULTI-REWARD SUPERFARMS */}
      {activeSection === 'FARMS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: 16, borderRadius: 16, background: 'oklch(0.6724 0.1308 38.7559 / 0.12)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Award size={24} color="var(--primary)" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>
                {language === 'ko' ? '멀티 토큰 파밍 & veHANOK 부스트 (최대 2.5배)' : 'Multi-Reward Superfarms & veHANOK Boost'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                {language === 'ko'
                  ? 'LP 토큰을 예치하여 $HANOK, $GIWA, $KRWC를 동시 채굴하세요. veHANOK 보유량에 따라 채굴 수익률이 최대 2.5배 부스팅됩니다.'
                  : 'Stake LP tokens to earn triple rewards ($HANOK + $GIWA + $KRWC) with up to 2.5x veHANOK boost.'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
            {farms.map((farm) => (
              <div key={farm.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>{farm.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>LP: {farm.lpPair}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 800, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      ⚡ {farm.userBoostMultiplier}x BOOST
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, background: 'var(--muted)', padding: 12, borderRadius: 14, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Total Farm APR</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{farm.totalAprPct}%</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Total Staked</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>{formatCurrencyValue(farm.totalStakedUSD)}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>동시 채굴 보상 토큰:</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {farm.rewardTokens.map((r) => (
                        <span key={r.symbol} style={{ padding: '3px 8px', borderRadius: 8, background: 'var(--muted)', border: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>
                          {r.icon} {r.symbol} (+{r.aprPct}%)
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Pending Rewards */}
                  <div style={{ background: 'var(--muted)', padding: 12, borderRadius: 12, fontSize: 11 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginBottom: 4 }}>미수령 보상 (Pending Rewards)</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, fontWeight: 700, color: 'var(--foreground)' }}>
                        {farm.pendingRewards.map((p) => (
                          <span key={p.symbol}>{p.amount} {p.symbol}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleClaimFarm(farm.id)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {language === 'ko' ? '모든 보상 일괄 수령 (Claim All)' : 'Claim Multi-Rewards'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1-Click ALM Deposit Modal */}
      {selectedVault && (
        <div
          onClick={() => setSelectedVault(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 440, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>{selectedVault.name} Deposit</div>
              <button onClick={() => setSelectedVault(null)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted-foreground)', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: 'var(--muted)', padding: 14, borderRadius: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>Deposit Amount (USD)</div>
              <input
                type="number"
                value={almDepositAmount}
                onChange={(e) => setAlmDepositAmount(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', background: 'none', border: 'none', fontSize: 22, fontWeight: 800, color: 'var(--foreground)', outline: 'none' }}
              />
            </div>

            <button
              onClick={handleAlmDeposit}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
            >
              Confirm 1-Click Deposit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component for individual pool rows
function PoolRow({
  pool,
  isExpanded,
  onToggle,
  provider,
  userAddress,
  onSuccess,
}: {
  pool: GiwaPoolData;
  isExpanded: boolean;
  onToggle: () => void;
  provider?: EIP1193Provider;
  userAddress?: string;
  onSuccess: () => void;
}) {
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const { formatCurrencyValue } = useCurrency();

  const [activeActionTab, setActiveActionTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [withdrawPct, setWithdrawPct] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleDeposit = async () => {
    if (!provider || !userAddress) {
      showToast('Please connect your wallet first', 'error');
      return;
    }
    if (!amount0 && !amount1) {
      showToast('Please enter an amount to deposit', 'error');
      return;
    }

    setIsSubmitting(true);
    setStatusMsg('Approving & Supplying...');
    try {
      if (pool.poolType !== 'STABLE') throw new Error('Concentrated liquidity deposits require a position manager and are not available yet.');
      const publicClient = createPublicClient({ chain: giwaSepolia, transport: http(GIWA_STANDARD_RPC) });
      const walletClient = createWalletClient({ chain: giwaSepolia, transport: custom(provider) });

      for (const contract of [pool.address, pool.token0, pool.token1]) {
        const code = await publicClient.getBytecode({ address: contract });
        if (!code || code === '0x') throw new Error('This pool or one of its tokens is not deployed on GIWA Sepolia.');
      }
      const parsed0 = parseUnits(amount0 || '0', pool.decimals0);
      const parsed1 = parseUnits(amount1 || '0', pool.decimals1);

      if (parsed0 > 0n) {
        const hash0 = await walletClient.writeContract({
          address: pool.token0,
          abi: erc20Abi,
          functionName: 'approve',
          args: [pool.address, parsed0],
          account: userAddress as Address,
        });
        await waitForSuccess(publicClient, hash0);
      }

      if (parsed1 > 0n) {
        const hash1 = await walletClient.writeContract({
          address: pool.token1,
          abi: erc20Abi,
          functionName: 'approve',
          args: [pool.address, parsed1],
          account: userAddress as Address,
        });
        await waitForSuccess(publicClient, hash1);
      }

      if (pool.poolType === 'STABLE') {
        const hash = await walletClient.writeContract({
          address: pool.address,
          abi: STABLE_POOL_ABI,
          functionName: 'add_liquidity',
          args: [[parsed0, parsed1], 0n],
          account: userAddress as Address,
        });
        await waitForSuccess(publicClient, hash);
      }

      showToast('Liquidity deposited successfully!', 'success');
      setAmount0('');
      setAmount1('');
      onSuccess();
    } catch (err: any) {
      showToast(err?.message || 'Deposit failed', 'error');
    } finally {
      setIsSubmitting(false);
      setStatusMsg('');
    }
  };

  const handleWithdraw = async () => {
    if (!provider || !userAddress || !pool.userPosition) return;

    setIsSubmitting(true);
    setStatusMsg('Withdrawing...');
    try {
      if (pool.poolType !== 'STABLE') throw new Error('Concentrated liquidity withdrawals are not connected yet.');
      const publicClient = createPublicClient({ chain: giwaSepolia, transport: http(GIWA_STANDARD_RPC) });
      const walletClient = createWalletClient({ chain: giwaSepolia, transport: custom(provider) });

      const totalLp = parseUnits(pool.userPosition.liquidity, 18);
      const withdrawAmount = (totalLp * BigInt(withdrawPct)) / 100n;

      if (pool.poolType === 'STABLE') {
        const hash = await walletClient.writeContract({
          address: pool.address,
          abi: STABLE_POOL_ABI,
          functionName: 'remove_liquidity',
          args: [withdrawAmount, [0n, 0n]],
          account: userAddress as Address,
        });
        await waitForSuccess(publicClient, hash);
      }

      showToast('Liquidity withdrawn successfully!', 'success');
      onSuccess();
    } catch (err: any) {
      showToast(err?.message || 'Withdraw failed', 'error');
    } finally {
      setIsSubmitting(false);
      setStatusMsg('');
    }
  };

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        onClick={onToggle}
        style={{
          display: isMobile ? 'flex' : 'grid',
          gridTemplateColumns: '2.2fr 1.2fr 1.2fr 1fr 100px',
          flexDirection: isMobile ? 'column' : undefined,
          gap: 10,
          padding: '16px 20px',
          alignItems: 'center',
          cursor: 'pointer',
          background: isExpanded ? 'var(--muted)' : 'transparent',
          transition: 'background 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', position: 'relative', width: 44 }}>
            <TokenIcon symbol={pool.symbol0} size={28} />
            <div style={{ marginLeft: -12 }}>
              <TokenIcon symbol={pool.symbol1} size={28} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {pool.name}
              {(pool.symbol0 === 'KRWC' || pool.symbol1 === 'KRWC') && (
                <span title="Dojang Verified Compliance Pool">
                  <ShieldCheck size={14} color="#3b82f6" />
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Fee: {pool.feePercent}</div>
          </div>
        </div>

        <div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: pool.poolType === 'CLAMM' ? 'oklch(0.6724 0.1308 38.7559 / 0.15)' : 'rgba(59, 130, 246, 0.15)', color: pool.poolType === 'CLAMM' ? 'var(--primary)' : '#3b82f6' }}>
            {pool.poolType}
          </span>
        </div>

        <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)' }}>
            {formatCurrencyValue(pool.tvlUsd)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            {pool.reserve0} {pool.symbol0} / {pool.reserve1} {pool.symbol1}
          </div>
        </div>

        <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#22c55e' }}>{pool.estimatedApy.toFixed(1)}%</div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: isExpanded ? 'var(--primary)' : 'var(--card)',
              color: isExpanded ? '#FFFFFF' : 'var(--foreground)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isExpanded ? 'Close' : 'Manage'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div style={{ padding: '16px 20px 24px', background: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setActiveActionTab('deposit')}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                border: 'none',
                background: activeActionTab === 'deposit' ? 'var(--primary)' : 'var(--card)',
                color: activeActionTab === 'deposit' ? '#FFFFFF' : 'var(--foreground)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.depositLiquidity}
            </button>
            <button
              onClick={() => setActiveActionTab('withdraw')}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                border: 'none',
                background: activeActionTab === 'withdraw' ? 'var(--primary)' : 'var(--card)',
                color: activeActionTab === 'withdraw' ? '#FFFFFF' : 'var(--foreground)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.withdrawLiquidity}
            </button>
          </div>

          {activeActionTab === 'deposit' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>{pool.symbol0} Amount</div>
                  <input
                    type="number"
                    value={amount0}
                    onChange={(e) => setAmount0(e.target.value)}
                    placeholder="0.0"
                    style={{ width: '100%', background: 'none', border: 'none', fontSize: 16, fontWeight: 700, color: 'var(--foreground)', outline: 'none' }}
                  />
                </div>

                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>{pool.symbol1} Amount</div>
                  <input
                    type="number"
                    value={amount1}
                    onChange={(e) => setAmount1(e.target.value)}
                    placeholder="0.0"
                    style={{ width: '100%', background: 'none', border: 'none', fontSize: 16, fontWeight: 700, color: 'var(--foreground)', outline: 'none' }}
                  />
                </div>
              </div>

              <button
                onClick={handleDeposit}
                disabled={isSubmitting}
                style={{
                  padding: '12px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  marginTop: 6,
                }}
              >
                {isSubmitting ? (statusMsg || t.loading) : t.supplyLiquidity}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8 }}>
                  <span>{t.removePercentage}</span>
                  <span style={{ fontWeight: 800, color: 'var(--foreground)' }}>{withdrawPct}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={withdrawPct}
                  onChange={(e) => setWithdrawPct(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setWithdrawPct(pct)}
                      style={{
                        flex: 1,
                        padding: '4px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: withdrawPct === pct ? 'var(--primary)' : 'var(--muted)',
                        color: withdrawPct === pct ? '#FFFFFF' : 'var(--foreground)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleWithdraw}
                disabled={isSubmitting || !pool.userPosition || Number(pool.userPosition.liquidity) <= 0}
                style={{
                  padding: '12px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'oklch(0.65 0.2 25)',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: isSubmitting || !pool.userPosition ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? (statusMsg || t.loading) : t.confirmWithdrawal}
              </button>
            </div>
          )}

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-foreground)' }}>
            <span>Contract: <a href={`https://sepolia-explorer.giwa.io/address/${pool.address}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>{pool.address.slice(0, 10)}... <ExternalLink size={10} style={{ display: 'inline' }} /></a></span>
            <span>Est. Rate: 1 {pool.symbol1} ≈ {pool.currentPrice} {pool.symbol0}</span>
          </div>
        </div>
      )}
    </div>
  );
}
