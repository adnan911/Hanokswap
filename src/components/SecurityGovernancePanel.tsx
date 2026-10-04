import { useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { useIsMobile } from '../useIsMobile';
import { showToast } from '../toast';
import {
  analyzeTokenSafety,
  type TokenSafetyReport,
} from '../lib/tokenSafety';
import {
  getGuardianMonitoredPools,
  triggerEmergencyPause,
  triggerEmergencyUnpause,
  simulateDepegEvent,
  type GuardianPoolStatus,
} from '../lib/emergencyGuardian';
import {
  getQueuedTimelockTransactions,
  queueNewGovernanceProposal,
  executeTimelockProposal,
  cancelTimelockProposal,
  type TimelockTransaction,
} from '../lib/timelock';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Clock,
  Search,
  PlusCircle,
  Play,
  XCircle,
} from 'lucide-react';
import type { Address } from 'viem';

type SecTab = 'SCANNER' | 'GUARDIAN' | 'TIMELOCK';

export default function SecurityGovernancePanel() {
  const isMobile = useIsMobile();
  const { language } = useLanguage();

  const [activeTab, setActiveTab] = useState<SecTab>('SCANNER');

  // Scanner State
  const [tokenInput, setTokenInput] = useState('0x89c0000000000000000000000000000000000001'); // KRWC default
  const [isScanning, setIsScanning] = useState(false);
  const [safetyReport, setSafetyReport] = useState<TokenSafetyReport | null>(null);

  // Guardian State
  const [guardianPools, setGuardianPools] = useState<GuardianPoolStatus[]>(getGuardianMonitoredPools());

  // Timelock State
  const [timelockTxs, setTimelockTxs] = useState<TimelockTransaction[]>(getQueuedTimelockTransactions());
  const [showNewProposalModal, setShowNewProposalModal] = useState(false);
  const [proposalTarget, setProposalTarget] = useState('0xe1525f69bf27890b5592ed7eb2e08bdb883d74b3');
  const [proposalName, setProposalName] = useState('ProtocolFeeVault');
  const [proposalAction, setProposalAction] = useState('Increase LP Share to 75%');

  const handleScanToken = async () => {
    if (!tokenInput.trim()) return;
    setIsScanning(true);
    try {
      const report = await analyzeTokenSafety(tokenInput.trim());
      setSafetyReport(report);
      showToast(`Scanned $${report.symbol}: Trust Score ${report.trustScore}/100`, 'success');
    } catch {
      showToast('Scan failed', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleTogglePause = (poolAddr: string, currentlyPaused: boolean) => {
    if (currentlyPaused) {
      triggerEmergencyUnpause(poolAddr);
      showToast('Pool unpaused by Emergency Guardian Admin', 'success');
    } else {
      triggerEmergencyPause(poolAddr);
      showToast('🚨 Emergency Circuit Breaker Triggered: Pool Paused!', 'error');
    }
    setGuardianPools([...getGuardianMonitoredPools()]);
  };

  const handleSimulateDepeg = (poolAddr: string) => {
    simulateDepegEvent(poolAddr, 3.8); // 3.8% depeg triggers circuit breaker
    setGuardianPools([...getGuardianMonitoredPools()]);
    showToast('🚨 Simulated 3.8% Depeg Triggered Automatic Emergency Pause!', 'error');
  };

  const handleExecuteTimelock = (txHash: string) => {
    executeTimelockProposal(txHash);
    setTimelockTxs([...getQueuedTimelockTransactions()]);
    showToast('48-hour Timelock Proposal Executed on Giwa Chain!', 'success');
  };

  const handleCancelTimelock = (txHash: string) => {
    cancelTimelockProposal(txHash);
    setTimelockTxs([...getQueuedTimelockTransactions()]);
    showToast('Timelock Proposal Cancelled', 'info');
  };

  const handleCreateProposal = () => {
    if (!proposalAction.trim()) return;
    queueNewGovernanceProposal(proposalTarget as Address, proposalName, proposalAction);
    setTimelockTxs([...getQueuedTimelockTransactions()]);
    setShowNewProposalModal(false);
    showToast('New proposal queued in 48h Timelock controller!', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: isMobile ? 460 : 1080, margin: '0 auto' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: '#ef4444', color: '#FFFFFF' }}>
              SECURITY &amp; RISK ENGINE
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>🛡️ 48h Timelock · Safe 3/5 Multi-Sig · Circuit Breakers</span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', gap: 8, background: 'var(--card)', padding: 6, borderRadius: 16, border: '1px solid var(--border)', overflowX: 'auto' }}>
        {[
          { id: 'SCANNER', label: language === 'ko' ? '🛡️ 토큰 안전성 & 허니팟 스캐너' : '🛡️ Token Safety & Honeypot Scanner', desc: 'Pre-flight Risk Analysis' },
          { id: 'GUARDIAN', label: language === 'ko' ? '🚨 디페그 서킷 브레이커' : '🚨 Depeg Circuit Breaker', desc: 'Emergency Pool Pausers' },
          { id: 'TIMELOCK', label: language === 'ko' ? '🏛️ 48시간 타임락 & 멀티시그' : '🏛️ 48h Timelock & Multi-Sig', desc: '3-of-5 Safe Governance' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as SecTab)}
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

      {/* TAB 1: TOKEN SAFETY & HONEYPOT SCANNER */}
      {activeTab === 'SCANNER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 24, padding: '2rem', boxShadow: '0 20px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', marginBottom: 12 }}>
              {language === 'ko' ? '스마트 컨트랙트 허니팟 & 보안 검사기' : 'Honeypot & Contract Safety Inspection'}
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16 }}>
              {language === 'ko'
                ? '스왑 전 토큰 컨트랙트의 매도 세금(Sell Tax), 무제한 민팅, 블랙리스트 함수, 유동성 락업 및 두나무 도장(Dojang) 인증 여부를 시뮬레이션합니다.'
                : 'Simulates transfer execution, honeypot locks, sell taxes, owner mint permissions, LP locks, and Dojang proofs before swapping.'}
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Paste Token Contract Address (0x...)"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                style={{ flex: 1, background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}
              />
              <button
                onClick={handleScanToken}
                disabled={isScanning}
                style={{ padding: '0 22px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: isScanning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Search size={16} />
                <span>{isScanning ? 'Scanning...' : 'Scan Token'}</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700 }}>Quick Check:</span>
              {[
                { symbol: 'KRWC', address: '0x89c0000000000000000000000000000000000001' },
                { symbol: 'USDC', address: '0x3600000000000000000000000000000000000000' },
                { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006' },
                { symbol: 'HANOK', address: '0x89c4000000000000000000000000000000000001' },
              ].map((q) => (
                <button
                  key={q.symbol}
                  onClick={() => {
                    setTokenInput(q.address);
                    analyzeTokenSafety(q.address, q.symbol).then(setSafetyReport);
                  }}
                  style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  ${q.symbol}
                </button>
              ))}
            </div>

            {/* Scan Results Card */}
            {safetyReport && (
              <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 20, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>${safetyReport.symbol}</span>
                      <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>({safetyReport.name})</span>
                      {safetyReport.isDojangVerified && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ShieldCheck size={12} /> Dojang Verified
                        </span>
                      )}
                    </div>
                    <div className="prism-mono" style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
                      {safetyReport.tokenAddress}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700 }}>TRUST SCORE</div>
                    <div className="prism-mono" style={{ fontSize: 24, fontWeight: 800, color: safetyReport.trustScore >= 80 ? '#22c55e' : safetyReport.trustScore >= 50 ? '#f59e0b' : '#ef4444' }}>
                      {safetyReport.trustScore} / 100
                    </div>
                  </div>
                </div>

                {/* Badges Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                  <div style={{ background: 'var(--card)', padding: 10, borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Honeypot Status</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: safetyReport.isHoneypot ? '#ef4444' : '#22c55e', marginTop: 2 }}>
                      {safetyReport.isHoneypot ? '🚨 HONEYPOT' : '✅ CAN SELL'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--card)', padding: 10, borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Sell Tax</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: safetyReport.sellTaxPct > 5 ? '#ef4444' : '#22c55e', marginTop: 2 }}>
                      {safetyReport.sellTaxPct}%
                    </div>
                  </div>

                  <div style={{ background: 'var(--card)', padding: 10, borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>LP Lock Proof</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: safetyReport.isLiquidityLocked ? '#22c55e' : '#f59e0b', marginTop: 2 }}>
                      {safetyReport.isLiquidityLocked ? '🔒 LOCKED' : '⚠️ UNLOCKED'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--card)', padding: 10, borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Ownership</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: safetyReport.isOwnershipRenounced ? '#22c55e' : '#f59e0b', marginTop: 2 }}>
                      {safetyReport.isOwnershipRenounced ? '✅ RENOUNCED' : '⚠️ ACTIVE OWNER'}
                    </div>
                  </div>
                </div>

                {/* Warnings List */}
                {safetyReport.warnings.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {safetyReport.warnings.map((w, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: safetyReport.isHoneypot ? '#ef4444' : 'var(--foreground)' }}>
                        <AlertTriangle size={14} color={safetyReport.isHoneypot ? '#ef4444' : '#f59e0b'} />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: EMERGENCY CIRCUIT BREAKERS & DEPEG PAUSERS */}
      {activeTab === 'GUARDIAN' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: 16, borderRadius: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ShieldAlert size={26} color="#ef4444" />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>
                  {language === 'ko' ? '디페그 & 비정상 유동성 유출 서킷 브레이커' : 'Depeg & Abnormal Drain Circuit Breakers'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                  {language === 'ko'
                    ? '스테이블코인 가격이 ±3% 이상 이탈하거나 10분간 30% 이상 유출 시 자동으로 해당 풀을 일시 중단합니다.'
                    : 'Automatically triggers emergency pause when stablecoin depeg exceeds ±3% or sudden TVL drain occurs.'}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
            {guardianPools.map((pool) => (
              <div key={pool.poolAddress} style={{ background: 'var(--card)', border: pool.isPaused ? '1px solid #ef4444' : '1px solid var(--border)', borderRadius: 20, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>{pool.poolName}</div>
                    {pool.isPaused ? (
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: '#ef4444', color: '#fff', fontWeight: 800 }}>
                        🚨 PAUSED
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontWeight: 800 }}>
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <div style={{ background: 'var(--muted)', padding: 10, borderRadius: 12, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-foreground)' }}>
                      <span>Target Peg:</span>
                      <span className="prism-mono" style={{ color: 'var(--foreground)', fontWeight: 700 }}>${pool.targetPegPrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
                      <span>Current Price:</span>
                      <span className="prism-mono" style={{ color: 'var(--foreground)', fontWeight: 700 }}>${pool.currentPrice.toFixed(6)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
                      <span>Deviation:</span>
                      <span className="prism-mono" style={{ color: Math.abs(pool.deviationPct) >= 3 ? '#ef4444' : '#22c55e', fontWeight: 800 }}>
                        {pool.deviationPct > 0 ? `+${pool.deviationPct}%` : `${pool.deviationPct}%`}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleTogglePause(pool.poolAddress, pool.isPaused)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: 10,
                      border: 'none',
                      background: pool.isPaused ? '#22c55e' : '#ef4444',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {pool.isPaused ? 'Unpause Pool' : 'Emergency Pause'}
                  </button>

                  {!pool.isPaused && (
                    <button
                      onClick={() => handleSimulateDepeg(pool.poolAddress)}
                      title="Simulate sudden depeg"
                      style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      <Flame size={14} color="#f59e0b" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: 48-HOUR TIMELOCK & 3-OF-5 SAFE MULTI-SIG */}
      {activeTab === 'TIMELOCK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: 16, borderRadius: 16, background: 'oklch(0.6724 0.1308 38.7559 / 0.12)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Clock size={26} color="var(--primary)" />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>
                  {language === 'ko' ? '48시간 지연 실행 타임락 & Safe 3/5 멀티시그' : '48-Hour Timelock Controller & Safe 3/5 Multi-Sig'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                  {language === 'ko'
                    ? '프로토콜 수수료 변경, 컨트랙트 업그레이드 등 주요 거버넌스 결정은 48시간의 대기 시간을 거쳐 실행됩니다.'
                    : 'Enforces 48-hour timelock delay and 3-of-5 Safe multisig consensus on critical administrative actions.'}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowNewProposalModal(true)}
              style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <PlusCircle size={16} />
              <span>{language === 'ko' ? '새 제안 등록' : 'Queue Proposal'}</span>
            </button>
          </div>

          {/* Timelock Queue List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {timelockTxs.map((tx) => (
              <div
                key={tx.txHash}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 18,
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>{tx.actionDescription}</span>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'var(--muted)', color: 'var(--foreground)', fontWeight: 700 }}>
                      Target: {tx.targetName}
                    </span>
                  </div>
                  <div className="prism-mono" style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                    TxHash: {tx.txHash.slice(0, 18)}... · Proposed by {tx.proposedBy.slice(0, 8)}...
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 700 }}>
                      Safe Signers: {tx.confirmations} / {tx.requiredConfirmations}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: tx.status === 'EXECUTED' ? '#22c55e' : tx.status === 'READY_TO_EXECUTE' ? '#3b82f6' : '#f59e0b' }}>
                      {tx.status === 'EXECUTED' ? '✅ EXECUTED' : tx.status === 'READY_TO_EXECUTE' ? '⚡ READY (48h Elapsed)' : '⏳ QUEUED (48h Lock)'}
                    </div>
                  </div>

                  {tx.status === 'READY_TO_EXECUTE' && (
                    <button
                      onClick={() => handleExecuteTimelock(tx.txHash)}
                      style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Play size={12} />
                      <span>Execute</span>
                    </button>
                  )}

                  {tx.status === 'QUEUED' && (
                    <button
                      onClick={() => handleCancelTimelock(tx.txHash)}
                      style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--muted)', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Queue New Governance Proposal */}
      {showNewProposalModal && (
        <div onClick={() => setShowNewProposalModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>Queue 48h Timelock Action</div>
              <button onClick={() => setShowNewProposalModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted-foreground)', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Target Contract Name</label>
                <input type="text" value={proposalName} onChange={(e) => setProposalName(e.target.value)} style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Target Address</label>
                <input type="text" value={proposalTarget} onChange={(e) => setProposalTarget(e.target.value)} style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>Proposal Action Description</label>
                <input type="text" placeholder="Describe the governance parameter update..." value={proposalAction} onChange={(e) => setProposalAction(e.target.value)} style={{ width: '100%', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }} />
              </div>
            </div>

            <button onClick={handleCreateProposal} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              Submit into 48h Timelock Queue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
