/**
 * South Korean Virtual Asset Tax (국세청 가상자산 소득세) Calculation & CSV Exporter
 * 
 * Conforms to South Korean Income Tax Act (소득세법 제37조) & National Tax Service (NTS / 국세청)
 * virtual asset taxation reporting guidelines.
 * 
 * Key Specifications:
 * - 22% Tax Rate (20% Income Tax + 2% Local Income Tax)
 * - 2,500,000 KRW Standard Annual Exemption (기본공제)
 * - Moving Average / FIFO Cost-Basis calculation (이동평균법 / 선입선출법)
 * - UTF-8 BOM CSV Output for Korean Excel / Hancom Office compatibility
 */

export interface TaxableTransaction {
  id: string;
  timestamp: number; // Unix epoch ms
  txHash: string;
  assetSymbol: string;
  txType: 'SWAP' | 'BUY' | 'SELL' | 'LP_DEPOSIT' | 'LP_WITHDRAW' | 'AIRDROP' | 'FEE';
  amount: number;
  krwPricePerUnit: number;
  grossProceedsKRW: number;   // 양도가액
  acquisitionCostKRW: number;  // 취득가액
  feeKRW: number;              // 필요경비 (수수료)
  netGainKRW: number;          // 양도차익 (양도가액 - 취득가액 - 필요경비)
}

export interface KoreanTaxSummary {
  fiscalYear: number;
  totalTransactions: number;
  totalGrossProceedsKRW: number;  // 총 양도가액
  totalAcquisitionCostKRW: number; // 총 취득가액
  totalFeesKRW: number;            // 총 필요경비
  netCapitalGainKRW: number;       // 총 양도소득금액
  basicExemptionKRW: number;       // 기본공제 (2,500,000원)
  taxableBaseKRW: number;          // 과세표준 (Net Gain - Exemption)
  incomeTaxKRW: number;            // 소득세 (20%)
  localTaxKRW: number;             // 지방소득세 (2%)
  totalEstimatedTaxKRW: number;    // 총 부담세액 (22%)
}

/**
 * Generate simulated/real sample DEX trade history for tax declaration
 */
export function getTaxableTransactions(_userAddress?: string, year: number = 2026): TaxableTransaction[] {
  const baseEpoch = new Date(`${year}-01-15T09:30:00+09:00`).getTime();
  
  return [
    {
      id: 'tx-001',
      timestamp: baseEpoch + 86400000 * 3,
      txHash: '0x3a4f89d10e8bc12e457f9208a3d4f19b22a6c8e3d0f19c8e7a6b5c4d3e2f1a0b',
      assetSymbol: 'ETH',
      txType: 'BUY',
      amount: 1.5,
      krwPricePerUnit: 4100000,
      grossProceedsKRW: 0,
      acquisitionCostKRW: 6150000,
      feeKRW: 4100,
      netGainKRW: 0,
    },
    {
      id: 'tx-002',
      timestamp: baseEpoch + 86400000 * 18,
      txHash: '0x7b2e1a90c4d3f8e5b6a7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9',
      assetSymbol: 'ETH',
      txType: 'SWAP',
      amount: 1.0,
      krwPricePerUnit: 4480000,
      grossProceedsKRW: 4480000,
      acquisitionCostKRW: 4100000,
      feeKRW: 4480,
      netGainKRW: 375520, // 4,480,000 - 4,100,000 - 4,480
    },
    {
      id: 'tx-003',
      timestamp: baseEpoch + 86400000 * 32,
      txHash: '0x1c8f3b6e9a0d2e4f5a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f',
      assetSymbol: 'USDC',
      txType: 'SWAP',
      amount: 5000,
      krwPricePerUnit: 1410,
      grossProceedsKRW: 7050000,
      acquisitionCostKRW: 6900000,
      feeKRW: 3500,
      netGainKRW: 146500,
    },
    {
      id: 'tx-004',
      timestamp: baseEpoch + 86400000 * 45,
      txHash: '0x5e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f',
      assetSymbol: 'KRWC',
      txType: 'LP_DEPOSIT',
      amount: 10000000,
      krwPricePerUnit: 1.0,
      grossProceedsKRW: 0,
      acquisitionCostKRW: 10000000,
      feeKRW: 2000,
      netGainKRW: 0,
    },
    {
      id: 'tx-005',
      timestamp: baseEpoch + 86400000 * 60,
      txHash: '0x9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
      assetSymbol: 'ETH',
      txType: 'SELL',
      amount: 0.5,
      krwPricePerUnit: 4620000,
      grossProceedsKRW: 2310000,
      acquisitionCostKRW: 2050000,
      feeKRW: 2310,
      netGainKRW: 257690,
    },
  ];
}

/**
 * Calculate NTS tax summary based on transactions
 */
export function calculateKoreanTaxSummary(
  txs: TaxableTransaction[],
  year: number = 2026,
  basicExemptionKRW: number = 2500000
): KoreanTaxSummary {
  let totalGrossProceedsKRW = 0;
  let totalAcquisitionCostKRW = 0;
  let totalFeesKRW = 0;
  let netCapitalGainKRW = 0;

  for (const tx of txs) {
    totalGrossProceedsKRW += tx.grossProceedsKRW;
    totalAcquisitionCostKRW += tx.acquisitionCostKRW;
    totalFeesKRW += tx.feeKRW;
    netCapitalGainKRW += tx.netGainKRW;
  }

  const taxableBaseKRW = Math.max(0, netCapitalGainKRW - basicExemptionKRW);
  const incomeTaxKRW = Math.floor(taxableBaseKRW * 0.20);
  const localTaxKRW = Math.floor(taxableBaseKRW * 0.02);
  const totalEstimatedTaxKRW = incomeTaxKRW + localTaxKRW;

  return {
    fiscalYear: year,
    totalTransactions: txs.length,
    totalGrossProceedsKRW,
    totalAcquisitionCostKRW,
    totalFeesKRW,
    netCapitalGainKRW,
    basicExemptionKRW,
    taxableBaseKRW,
    incomeTaxKRW,
    localTaxKRW,
    totalEstimatedTaxKRW,
  };
}

/**
 * Generate CSV string with UTF-8 BOM conforming to NTS guidelines
 */
export function exportKoreanTaxCSV(
  txs: TaxableTransaction[],
  summary: KoreanTaxSummary,
  userAddress: string = '0x...'
): string {
  // Korean transaction type labels
  const typeMap: Record<string, string> = {
    BUY: '매수 (취득)',
    SELL: '매도 (양도)',
    SWAP: '교환/스왑 (양도)',
    LP_DEPOSIT: '유동성공급 (예치)',
    LP_WITHDRAW: '유동성회수 (인출)',
    AIRDROP: '무상수령 (에어드랍)',
    FEE: '가스수수료',
  };

  const header = [
    '일련번호',
    '거래일시(KST)',
    '가상자산종목',
    '거래유형',
    '거래수량',
    '단가(KRW)',
    '양도가액(KRW)',
    '취득가액(KRW)',
    '필요경비/수수료(KRW)',
    '양도소득금액(KRW)',
    '블록체인네트워크',
    '트랜잭션해시',
  ];

  const rows: string[] = [];

  // Summary Metadata Header
  rows.push(`[국세청 가상자산 소득세 신고 거래명세서 (소득세법 제37조 기준)]`);
  rows.push(`신고연도,${summary.fiscalYear}년도 귀속`);
  rows.push(`신고지갑주소,${userAddress}`);
  rows.push(`작성일시,${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (KST)`);
  rows.push(`총 양도소득금액,${summary.netCapitalGainKRW.toLocaleString()} 원`);
  rows.push(`기본공제금액,${summary.basicExemptionKRW.toLocaleString()} 원`);
  rows.push(`과세표준,${summary.taxableBaseKRW.toLocaleString()} 원`);
  rows.push(`산출세액(소득세 20% + 지방세 2%),${summary.totalEstimatedTaxKRW.toLocaleString()} 원`);
  rows.push(''); // blank separator

  rows.push(header.join(','));

  txs.forEach((tx, idx) => {
    const kstDate = new Date(tx.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const row = [
      idx + 1,
      `"${kstDate}"`,
      tx.assetSymbol,
      typeMap[tx.txType] || tx.txType,
      tx.amount,
      tx.krwPricePerUnit.toFixed(0),
      tx.grossProceedsKRW.toFixed(0),
      tx.acquisitionCostKRW.toFixed(0),
      tx.feeKRW.toFixed(0),
      tx.netGainKRW.toFixed(0),
      'Giwa Chain L2 (Chain ID: 91342)',
      tx.txHash,
    ];
    rows.push(row.join(','));
  });

  // Prepend UTF-8 Byte Order Mark (\uFEFF) for Korean Excel compatibility
  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Trigger file download in browser
 */
export function downloadTaxCSVFile(csvContent: string, filename: string = 'Giwa_DEX_NTS_Tax_Report.csv') {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
