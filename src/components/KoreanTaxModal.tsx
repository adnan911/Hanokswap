import { useState, useMemo } from 'react';
import { useLanguage } from '../LanguageContext';
import {
  getTaxableTransactions,
  calculateKoreanTaxSummary,
  exportKoreanTaxCSV,
  downloadTaxCSVFile,
} from '../lib/koreanTaxExport';
import {
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Calendar,
  DollarSign,
  TrendingUp,
  Info,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userAddress?: string;
}

export function KoreanTaxModal({ isOpen, onClose, userAddress }: Props) {
  const { language } = useLanguage();
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [basicExemption, setBasicExemption] = useState<number>(2500000); // 2.5M KRW standard

  const transactions = useMemo(() => {
    return getTaxableTransactions(userAddress, selectedYear);
  }, [userAddress, selectedYear]);

  const summary = useMemo(() => {
    return calculateKoreanTaxSummary(transactions, selectedYear, basicExemption);
  }, [transactions, selectedYear, basicExemption]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const csvData = exportKoreanTaxCSV(transactions, summary, userAddress || '0xDemoWallet');
    const filename = `Giwa_DEX_NTS_Tax_${selectedYear}_${(userAddress || 'wallet').slice(0, 8)}.csv`;
    downloadTaxCSVFile(csvData, filename);
  };

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
          maxWidth: 680,
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
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)' }}>
                {language === 'ko' ? '국세청(NTS) 가상자산 소득세 신고 계산기' : 'South Korean NTS Crypto Tax Exporter'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                {language === 'ko' ? '소득세법 제37조 기준 · 22% 단일세율 (소득세 20% + 지방세 2%)' : 'Income Tax Act Art. 37 · 22% Standard Rate'}
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

        {/* Year & Exemption Selectors */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, background: 'var(--muted)', padding: 12, borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={13} /> {language === 'ko' ? '신고 귀속 연도' : 'Tax Fiscal Year'}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[2025, 2026].map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 8,
                    border: selectedYear === yr ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: selectedYear === yr ? 'var(--primary)' : 'var(--card)',
                    color: selectedYear === yr ? '#fff' : 'var(--foreground)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {yr}년
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, background: 'var(--muted)', padding: 12, borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={13} /> {language === 'ko' ? '기본공제 한도' : 'Basic Exemption'}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { label: '250만 원 (표준)', val: 2500000 },
                { label: '5,000만 원 (개정안)', val: 50000000 },
              ].map((ex) => (
                <button
                  key={ex.val}
                  onClick={() => setBasicExemption(ex.val)}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    borderRadius: 8,
                    border: basicExemption === ex.val ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: basicExemption === ex.val ? 'var(--primary)' : 'var(--card)',
                    color: basicExemption === ex.val ? '#fff' : 'var(--foreground)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tax Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ padding: 14, borderRadius: 14, background: 'var(--muted)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
              {language === 'ko' ? '총 양도소득 (차익)' : 'Net Capital Gain'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: summary.netCapitalGainKRW >= 0 ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
              <TrendingUp size={16} />
              ₩{summary.netCapitalGainKRW.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 4 }}>
              {summary.totalTransactions}건 거래 완료
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 14, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginBottom: 4 }}>
              {language === 'ko' ? '예상 총 납부세액 (22%)' : 'Estimated Tax Due (22%)'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
              <DollarSign size={16} />
              ₩{summary.totalEstimatedTaxKRW.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 4 }}>
              소득세 20% + 지방세 2%
            </div>
          </div>
        </div>

        {/* Tax Calculation Details */}
        <div style={{ background: 'var(--muted)', padding: 14, borderRadius: 14, border: '1px solid var(--border)', marginBottom: 20, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)' }}>
            <span>{language === 'ko' ? '총 양도가액 (매도/스왑 합계)' : 'Gross Proceeds'}</span>
            <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>₩{summary.totalGrossProceedsKRW.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)' }}>
            <span>{language === 'ko' ? '총 취득가액 (원가)' : 'Acquisition Cost Basis'}</span>
            <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>₩{summary.totalAcquisitionCostKRW.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)' }}>
            <span>{language === 'ko' ? '공제 필요경비 (DEX 가스비/수수료)' : 'Deductible Gas Fees'}</span>
            <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>-₩{summary.totalFeesKRW.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
            <span>{language === 'ko' ? '기본공제액 적용' : 'Basic Exemption'}</span>
            <span style={{ fontWeight: 700, color: '#3b82f6' }}>-₩{Math.min(summary.netCapitalGainKRW, summary.basicExemptionKRW).toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--foreground)', fontWeight: 800, fontSize: 13 }}>
            <span>{language === 'ko' ? '최종 과세표준' : 'Final Taxable Base'}</span>
            <span style={{ color: 'var(--primary)' }}>₩{summary.taxableBaseKRW.toLocaleString()}</span>
          </div>
        </div>

        {/* NTS Excel Download Button */}
        <button
          onClick={handleDownload}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: 14,
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            marginBottom: 12,
          }}
        >
          <Download size={18} />
          <span>{language === 'ko' ? '국세청 홈택스 제출용 CSV 다운로드 (UTF-8 BOM)' : 'Download NTS Hometax CSV (Excel Ready)'}</span>
        </button>

        {/* Notice */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: 'var(--muted-foreground)' }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            {language === 'ko'
              ? '본 계산서는 기와체인(Giwa L2) 온체인 스마트 컨트랙트 거래 기록을 기반으로 자동 산출된 참고용 자료입니다. 종합소득세 신고 시 세무 대리인의 검토를 권장합니다.'
              : 'This tax estimate is automatically generated from on-chain smart contract logs on Giwa L2. Consult a certified tax accountant for official filing.'}
          </span>
        </div>
      </div>
    </div>
  );
}
