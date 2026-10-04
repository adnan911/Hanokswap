import { createContext, useContext, useState, type ReactNode } from 'react';

export type Language = 'en' | 'ko';

export interface Translations {
  // Navigation & Common
  home: string;
  swap: string;
  bridge: string;
  pools: string;
  createToken: string;
  docs: string;
  portfolio: string;
  analytics: string;
  history: string;
  connectWallet: string;
  walletConnected: string;
  launchApp: string;
  guestMode: string;
  guestModeDesc: string;
  addressCopied: string;
  disconnect: string;
  refresh: string;
  loading: string;
  search: string;
  filter: string;
  all: string;
  status: string;
  type: string;
  asset: string;
  amount: string;
  date: string;
  viewAll: string;
  close: string;
  success: string;
  pending: string;
  failed: string;

  // Header & Landing
  heroBadge: string;
  heroTitle1: string;
  heroTitle2: string;
  heroSubtitle: string;
  exploreMarkets: string;
  instantRouting: string;
  multiChainLive: string;
  youPay: string;
  youReceive: string;
  balance: string;
  optimalRoute: string;
  connectAndTrade: string;
  footerDesc: string;
  footerRights: string;
  nonCustodialTag: string;

  // Landing Features
  featuresHeading: string;
  feat1Badge: string;
  feat1Title: string;
  feat1Desc: string;
  feat2Badge: string;
  feat2Title: string;
  feat2Desc: string;
  feat3Badge: string;
  feat3Title: string;
  feat3Desc: string;
  feat4Badge: string;
  feat4Title: string;
  feat4Desc: string;
  feat5Badge: string;
  feat5Title: string;
  feat5Desc: string;
  feat6Badge: string;
  feat6Title: string;
  feat6Desc: string;

  // Pools Page
  poolsTitle: string;
  poolsSubtitle: string;
  tvl: string;
  activePools: string;
  volume24h: string;
  allPools: string;
  concentratedClamm: string;
  stableswap: string;
  searchPools: string;
  poolPair: string;
  protocolType: string;
  tvlReserves: string;
  estApy: string;
  depositLiquidity: string;
  withdrawLiquidity: string;
  yourActivePosition: string;
  poolShare: string;
  supplyLiquidity: string;
  confirmWithdrawal: string;
  removePercentage: string;
  giwaSepoliaDex: string;
  flashblocksEnabled: string;
  poolsRefreshed: string;
  approving: string;
  depositing: string;
  withdrawing: string;

  // Swap & Bridge
  swapTitle: string;
  swapSubtitle: string;
  bridgeTitle: string;
  bridgeSubtitle: string;
  slippageTolerance: string;
  flashblocksFast: string;
  kimchiPremiumBadge: string;
  insufficientBalance: string;

  // Dashboard / Portfolio
  portfolioTitle: string;
  portfolioSubtitle: string;
  totalNetWorth: string;
  portfolioBreakdown: string;
  assetDistribution: string;
  recentActivity: string;
  noAssetsFound: string;
  viewExplorer: string;

  // Analytics
  analyticsTitle: string;
  analyticsSubtitle: string;
  globalStablecoinLiquidity: string;
  stablecoinDominance: string;
  topAssets: string;
  livePegTracking: string;
  pegged: string;

  // AI Copilot & Chat
  copilotTitle: string;
  copilotSubtitle: string;
  askCopilotPlaceholder: string;
  send: string;
  marketInsights: string;
  sampleQuestions: string[];

  // Connect Modal & Wallet
  modalConnectTitle: string;
  modalConnectDesc: string;
  modalNonCustodialNotice: string;
  popularWallets: string;
  browserDetected: string;
  installWallet: string;
}

const translations: Record<Language, Translations> = {
  en: {
    home: 'Home',
    swap: 'Swap',
    bridge: 'Bridge & Faucet',
    pools: 'Pools',
    createToken: 'Create Token',
    docs: 'Docs & Guide',
    portfolio: 'Portfolio',
    analytics: 'Analytics',
    history: 'History',
    connectWallet: 'Connect Wallet',
    walletConnected: 'Wallet connected',
    launchApp: 'Launch App',
    guestMode: 'GUEST MODE',
    guestModeDesc: 'Connect your wallet to trade, bridge, and manage assets.',
    addressCopied: 'Address copied',
    disconnect: 'Disconnect',
    refresh: 'Refresh',
    loading: 'Loading...',
    search: 'Search',
    filter: 'Filter',
    all: 'All',
    status: 'Status',
    type: 'Type',
    asset: 'Asset',
    amount: 'Amount',
    date: 'Date',
    viewAll: 'View All',
    close: 'Close',
    success: 'Success',
    pending: 'Pending',
    failed: 'Failed',

    heroBadge: 'Multi-Chain DEX · Giwa Flashblocks',
    heroTitle1: 'Decentralized Trading.',
    heroTitle2: 'Harmonious Multi-Chain Flow.',
    heroSubtitle: 'Institutional sub-second trading and deep multi-currency FX liquidity powered by Giwa Flashblocks.',
    exploreMarkets: 'Explore Markets',
    instantRouting: 'INSTANT ROUTING',
    multiChainLive: 'Multi-Chain Live',
    youPay: 'You Pay',
    youReceive: 'You Receive',
    balance: 'Balance',
    optimalRoute: 'Optimal Route',
    connectAndTrade: 'Connect Wallet & Trade',
    footerDesc: 'Next-generation decentralized exchange and multi-currency liquidity protocol. Non-custodial, high-velocity, and optimized for sub-second block times.',
    footerRights: '© 2026 HanokSwap Protocol. All rights reserved.',
    nonCustodialTag: 'Non-Custodial Multi-Chain DeFi',

    featuresHeading: 'Engineered for Next-Gen DeFi Performance',
    feat1Badge: 'Non-Custodial',
    feat1Title: 'Self-Custodial Architecture',
    feat1Desc: 'Every transaction is signed directly by your browser wallet. HanokSwap never takes custody of your funds or private keys.',
    feat2Badge: 'Multi-Chain DEX',
    feat2Title: 'Multi-Chain DEX Aggregation',
    feat2Desc: 'Access deep liquidity across Ethereum, Arbitrum, Base, Optimism, and Giwa L2 with dynamic routing.',
    feat3Badge: 'Token Deployer',
    feat3Title: 'Launchpad & Token Deployer',
    feat3Desc: 'Launch bonding curve tokens or deploy anti-snipe ERC-20 contracts.',
    feat4Badge: 'Developer Docs',
    feat4Title: 'Developer Documentation',
    feat4Desc: 'Smart contract addresses, architecture specifications, and SDK integrations.',
    feat5Badge: 'Lowest Slippage',
    feat5Title: 'Minimal Gas & Maximum Speed',
    feat5Desc: 'Optimized contracts and multi-hop DEX routing ensuring fast finality and lowest possible execution fees.',
    feat6Badge: 'Live Analytics',
    feat6Title: 'Real-Time Portfolio Intelligence',
    feat6Desc: 'Live on-chain balances, multi-token breakdowns, net worth tracking, and verified transaction receipts.',

    poolsTitle: 'Liquidity Pools',
    poolsSubtitle: 'Supply liquidity to CLAMM and Stableswap pools to earn automated trading fees.',
    tvl: 'TOTAL VALUE LOCKED',
    activePools: 'ACTIVE POOLS',
    volume24h: '24H DEX VOLUME',
    allPools: 'All Pools',
    concentratedClamm: 'Concentrated (CLAMM)',
    stableswap: 'Stableswap',
    searchPools: 'Search pair or pool address',
    poolPair: 'POOL PAIR',
    protocolType: 'PROTOCOL TYPE',
    tvlReserves: 'TVL & RESERVES',
    estApy: 'EST. APY',
    depositLiquidity: 'Deposit Liquidity',
    withdrawLiquidity: 'Withdraw Liquidity',
    yourActivePosition: 'YOUR ACTIVE POSITION',
    poolShare: 'Pool Share',
    supplyLiquidity: 'Supply Liquidity',
    confirmWithdrawal: 'Confirm Withdrawal',
    removePercentage: 'Remove Percentage',
    giwaSepoliaDex: 'GIWA SEPOLIA DEX',
    flashblocksEnabled: 'Chain ID: 91342 · Flashblocks Enabled',
    poolsRefreshed: 'Pools data refreshed',
    approving: 'Approving tokens...',
    depositing: 'Depositing liquidity...',
    withdrawing: 'Withdrawing liquidity...',

    swapTitle: 'Swap',
    swapSubtitle: 'Trade tokens instantly with minimal slippage and optimal routing.',
    bridgeTitle: 'Bridge & Faucet',
    bridgeSubtitle: 'Transfer assets securely between Ethereum Sepolia and GIWA Layer 2.',
    slippageTolerance: 'Slippage Tolerance',
    flashblocksFast: '0.2s Flashblocks Sub-second Execution',
    kimchiPremiumBadge: 'Kimchi Premium',
    insufficientBalance: 'Insufficient balance',

    portfolioTitle: 'Portfolio',
    portfolioSubtitle: 'Track your balances, active liquidity positions, and transaction history.',
    totalNetWorth: 'TOTAL NET WORTH',
    portfolioBreakdown: 'Portfolio Breakdown',
    assetDistribution: 'Asset Distribution',
    recentActivity: 'Recent Activity',
    noAssetsFound: 'No assets found in connected wallet',
    viewExplorer: 'View on Explorer',

    analyticsTitle: 'Analytics',
    analyticsSubtitle: 'Real-time volume, Kimchi premium spreads, and protocol liquidity.',
    globalStablecoinLiquidity: 'GLOBAL STABLECOIN LIQUIDITY',
    stablecoinDominance: 'Stablecoin Market Dominance',
    topAssets: 'Top Assets',
    livePegTracking: 'Live Price & Peg Deviation',
    pegged: 'PEGGED',

    copilotTitle: 'Market Assistant',
    copilotSubtitle: 'Real-time market insights and token metrics.',
    askCopilotPlaceholder: 'Search markets or query liquidity...',
    send: 'Send',
    marketInsights: 'Market Insights',
    sampleQuestions: [
      'How does Smart Order Routing work on HanokSwap?',
      'What token pairs are supported on Giwa L2?',
      'How do I supply liquidity to CLAMM pools?',
      'What is the current Kimchi premium rate?',
    ],

    modalConnectTitle: 'Connect Wallet',
    modalConnectDesc: 'Connect your wallet to trade on HanokSwap.',
    modalNonCustodialNotice: 'Non-custodial & secure. HanokSwap never stores your private keys.',
    popularWallets: 'POPULAR WALLETS',
    browserDetected: 'DETECTED IN BROWSER',
    installWallet: 'Install',
  },
  ko: {
    home: '홈',
    swap: '스왑',
    bridge: '브릿지 & 수도꼭지',
    pools: '유동성 풀',
    createToken: '토큰 생성',
    docs: '개발자 문서',
    portfolio: '포트폴리오',
    analytics: '시장 분석',
    history: '거래 내역',
    connectWallet: '지갑 연결',
    walletConnected: '지갑이 연결되었습니다',
    launchApp: '앱 시작하기',
    guestMode: '게스트 모드',
    guestModeDesc: '거래, 브릿지 및 자산 관리를 위해 지갑을 연결하세요.',
    addressCopied: '지갑 주소가 복사되었습니다',
    disconnect: '연결 해제',
    refresh: '새로고침',
    loading: '불러오는 중...',
    search: '검색',
    filter: '필터',
    all: '전체',
    status: '상태',
    type: '유형',
    asset: '자산',
    amount: '수량',
    date: '일시',
    viewAll: '전체 보기',
    close: '닫기',
    success: '완료됨',
    pending: '진행중',
    failed: '실패',

    heroBadge: '멀티체인 DEX · 기와(Giwa) 플래শব록',
    heroTitle1: '탈중앙화 트레이딩의 새로운 기준.',
    heroTitle2: '조화로운 멀티체인 디파이 생태계.',
    heroSubtitle: '0.2초 플래শব록과 딥 FX 유동성을 기반으로 한 차세대 탈중앙화 거래 프로토콜.',
    exploreMarkets: '시장 둘러보기',
    instantRouting: '초고속 라우팅',
    multiChainLive: '멀티체인 라이브',
    youPay: '지불할 금액',
    youReceive: '받을 예상 금액',
    balance: '보유 잔고',
    optimalRoute: '최적 경로',
    connectAndTrade: '지갑 연결하고 거래 시작',
    footerDesc: '차세대 탈중앙화 거래소 및 멀티체인 유동성 프로토콜. 비수탁형 자산 관리, 초고속 체결을 지원합니다.',
    footerRights: '© 2026 하옥스왑(HanokSwap) 프로토콜. All rights reserved.',
    nonCustodialTag: '비수탁형 멀티체인 디파이 (DeFi)',

    featuresHeading: '차세대 탈중앙화 금융을 위한 고성능 인프라',
    feat1Badge: '비수탁형 보안',
    feat1Title: '완전 비수탁형 아키텍처',
    feat1Desc: '모든 트랜잭션은 사용자의 브라우저 지갑에서 직접 서명됩니다. 하옥스왑은 개인키나 자산을 절대 보관하지 않습니다.',
    feat2Badge: '멀티체인 DEX',
    feat2Title: '멀티체인 DEX 유동성 집약',
    feat2Desc: '이더리움, 아비트럼, 베이스, 옵티미즘 등 주요 네트워크의 최상위 유동성을 동적 라우팅으로 지원합니다.',
    feat3Badge: '토큰 런치패드',
    feat3Title: '토큰 생성 & 런치패드',
    feat3Desc: '본딩커브 페어 런치 또는 안티 스나이핑 보호 ERC-20 토큰을 배포하세요.',
    feat4Badge: '개발자 문서',
    feat4Title: '개발자 문서 & 가이드',
    feat4Desc: '스마트 컨트랙트 주소, 아키텍처 사양 및 개발자 SDK 연동 가이드.',
    feat5Badge: '최저 슬리피지',
    feat5Title: '최소 가스비 & 초고속 완결',
    feat5Desc: '최적화된 스마트 컨트랙트와 멀티홉 DEX 라우팅으로 수수료를 절감하고 밀리초 단위 속도를 구현합니다.',
    feat6Badge: '실시간 분석',
    feat6Title: '실시간 포트폴리오 인텔리전스',
    feat6Desc: '체인별 자산 잔고, 멀티 토큰 구성비, 순자산 가치 및 검증된 영수증을 실시간으로 추적합니다.',

    poolsTitle: '유동성 풀',
    poolsSubtitle: 'CLAMM 및 스테이블스왑 풀에 유동성을 공급하고 실시간 거래 수수료를 획득하세요.',
    tvl: '총 예치 자산 (TVL)',
    activePools: '활성 풀 개수',
    volume24h: '24시간 거래량',
    allPools: '전체 풀',
    concentratedClamm: '집중 유동성 (CLAMM)',
    stableswap: '스테이블스왑',
    searchPools: '페어 또는 풀 주소 검색',
    poolPair: '풀 페어',
    protocolType: '프로토콜 유형',
    tvlReserves: 'TVL 및 예치 잔액',
    estApy: '예상 연이율 (APY)',
    depositLiquidity: '유동성 공급',
    withdrawLiquidity: '유동성 출금',
    yourActivePosition: '나의 활성 포지션',
    poolShare: '풀 지분율',
    supplyLiquidity: '유동성 공급 승인',
    confirmWithdrawal: '출금 확정',
    removePercentage: '출금 비율',
    giwaSepoliaDex: '기와(GIWA) 테스트넷 DEX',
    flashblocksEnabled: '체인 ID: 91342 · 플래শব록 활성화',
    poolsRefreshed: '유동성 풀 데이터를 새로고침했습니다',
    approving: '토큰 승인 중...',
    depositing: '유동성 공급 중...',
    withdrawing: '유동성 출금 중...',

    swapTitle: '스왑',
    swapSubtitle: '최적의 스마트 주문 라우팅과 0.2초 플래শব록으로 토큰을 즉시 교환하세요.',
    bridgeTitle: '브릿지 & 수도꼭지',
    bridgeSubtitle: '이더리움 세폴리아와 기와 L2 간 안전하고 빠른 자산 전송을 지원합니다.',
    slippageTolerance: '슬리피지 허용 범위',
    flashblocksFast: '0.2초 플래শব록 초고속 체결',
    kimchiPremiumBadge: '김치 프리미엄',
    insufficientBalance: '잔액이 부족합니다',

    portfolioTitle: '포트폴리오',
    portfolioSubtitle: '보유 자산 잔고, 활성 유동성 포지션 및 트랜잭션 내역을 확인하세요.',
    totalNetWorth: '총 순자산 가치',
    portfolioBreakdown: '포트폴리오 구성',
    assetDistribution: '자산 분포도',
    recentActivity: '최근 활동 내역',
    noAssetsFound: '연결된 지갑에서 보유 자산을 찾을 수 없습니다',
    viewExplorer: '블록 탐색기에서 보기',

    analyticsTitle: '시장 분석',
    analyticsSubtitle: '실시간 거래량, 김치 프리미엄 스프레드 및 프로토콜 유동성 현황.',
    globalStablecoinLiquidity: '글로벌 스테이블코인 유동성',
    stablecoinDominance: '스테이블코인 시장 점유율',
    topAssets: '주요 자산',
    livePegTracking: '실시간 가격 및 페그 현황',
    pegged: '페그 유지됨',

    copilotTitle: '디파이 어시스턴트',
    copilotSubtitle: '실시간 시장 동향 및 토큰 지표.',
    askCopilotPlaceholder: '시장 분석 또는 유동성을 검색하세요...',
    send: '전송',
    marketInsights: '시장 분석',
    sampleQuestions: [
      '하옥스왑에서 스마트 오더 라우팅은 어떻게 동작하나요?',
      '지원하는 블록체인 네트워크는 어떤 것이 있나요?',
      '기와 유동성 풀에 자산을 공급하는 방법을 알려줘',
      '현재 김치 프리미엄 시세를 알려줘',
    ],

    modalConnectTitle: '지갑 연결',
    modalConnectDesc: '하옥스왑에서 거래를 시작하려면 브라우저 지갑을 연결하세요.',
    modalNonCustodialNotice: '완전 비수탁형 보안. 하옥스왑은 개인키를 절대 수집하지 않습니다.',
    popularWallets: '주요 지원 지갑',
    browserDetected: '브라우저 감지된 지갑',
    installWallet: '설치하기',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('hanok-lang') || localStorage.getItem('flowfi-lang');
      if (saved === 'ko' || saved === 'en') return saved;
      // Auto detect Korean browser environment
      if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ko')) {
        return 'ko';
      }
    } catch {}
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('hanok-lang', lang);
    } catch {}
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ko' : 'en');
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
