import { useState } from 'react';
import type { EIP1193Provider } from 'viem';
import { useLanguage } from '../LanguageContext';
import { useIsMobile } from '../useIsMobile';
import { showToast } from '../toast';
import {
  Copy,
  Check,
  Zap,
  ExternalLink,
  Coins,
  Droplets,
  Sparkles,
  Terminal,
  ArrowRight,
  FileCode2,
} from 'lucide-react';
import {
  GIWA_MULTICALL3,
  GIWA_WETH,
  GIWA_L2_STANDARD_BRIDGE,
  GIWA_L1_STANDARD_BRIDGE,
  GIWA_DEX_FACTORY,
  GIWA_DEX_ROUTER,
  GIWA_DEX_CL_DEPLOYER,
  GIWA_DEX_STABLE_DEPLOYER,
  USDC_ADDRESS,
  KRWC_ADDRESS,
  EURC_ADDRESS,
} from '../contracts';
import { GIWA_STANDARD_RPC, GIWA_FLASHBLOCKS_RPC } from '../chains';

interface Props {
  provider?: EIP1193Provider;
  onNavigateToDeployer?: () => void;
  onNavigateToPools?: () => void;
  onNavigateToSwap?: () => void;
}

export default function GiwaDocsGuide({
  provider,
  onNavigateToDeployer,
  onNavigateToPools,
  onNavigateToSwap,
}: Props) {
  const { language } = useLanguage();
  const isMobile = useIsMobile();

  const [activeSection, setActiveSection] = useState<'quickstart' | 'token-guide' | 'dex-guide' | 'contracts'>('quickstart');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [codeTab, setCodeTab] = useState<'solidity' | 'foundry' | 'hardhat' | 'viem'>('solidity');

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(language === 'ko' ? '클립보드에 복사되었습니다!' : 'Copied to clipboard!', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddNetwork = async () => {
    if (!provider) {
      showToast('Please connect your wallet first', 'error');
      return;
    }
    try {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0x164ce',
            chainName: 'GIWA Sepolia Testnet',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [GIWA_FLASHBLOCKS_RPC, GIWA_STANDARD_RPC],
            blockExplorerUrls: ['https://sepolia-explorer.giwa.io'],
          },
        ],
      });
      showToast(language === 'ko' ? 'GIWA 테스트넷 네트워크가 지갑에 추가되었습니다!' : 'GIWA Sepolia network added to wallet!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to add network', 'error');
    }
  };

  const solidityCode = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GiwaCustomToken
 * @dev Standard OpenZeppelin ERC-20 deployed on GIWA Sepolia (Chain ID 91342)
 */
contract GiwaCustomToken is ERC20, Ownable {
    uint8 private _customDecimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        _customDecimals = decimals_;
        _mint(msg.sender, initialSupply_ * 10 ** decimals_);
    }

    function decimals() public view virtual override returns (uint8) {
        return _customDecimals;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}`;

  const foundryCode = `# 1. Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 2. Deploy to Giwa Sepolia (Chain ID: 91342)
forge create src/GiwaCustomToken.sol:GiwaCustomToken \\
  --rpc-url https://sepolia-rpc-flashblocks.giwa.io \\
  --private-key <YOUR_PRIVATE_KEY> \\
  --constructor-args "My Testnet Token" "MTK" 18 1000000

# 3. Verify on Giwa Explorer
forge verify-contract <DEPLOYED_ADDRESS> src/GiwaCustomToken.sol:GiwaCustomToken \\
  --verifier-url https://sepolia-explorer.giwa.io/api \\
  --verifier blockscout`;

  const hardhatCode = `// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    giwaSepolia: {
      url: "https://sepolia-rpc-flashblocks.giwa.io",
      chainId: 91342,
      accounts: [process.env.PRIVATE_KEY || ""],
    },
  },
  etherscan: {
    apiKey: {
      giwaSepolia: "empty",
    },
    customChains: [
      {
        network: "giwaSepolia",
        chainId: 91342,
        urls: {
          apiURL: "https://sepolia-explorer.giwa.io/api",
          browserURL: "https://sepolia-explorer.giwa.io",
        },
      },
    ],
  },
};

export default config;`;

  const viemCode = `import { createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { giwaSepolia } from './chains';
import { ERC20_DEPLOY_ABI, ERC20_BYTECODE } from './contracts';

async function deployToken() {
  const account = privateKeyToAccount('0x...');
  const walletClient = createWalletClient({
    account,
    chain: giwaSepolia,
    transport: http('https://sepolia-rpc-flashblocks.giwa.io'),
  });

  const hash = await walletClient.deployContract({
    abi: ERC20_DEPLOY_ABI,
    bytecode: ERC20_BYTECODE,
    args: ['Giwa Testnet Token', 'GTT', 18, parseUnits('1000000', 18)],
  });

  console.log('Deployment Tx:', hash);
}

deployToken();`;

  const contractsList = [
    { name: 'DEX Factory', address: GIWA_DEX_FACTORY, desc: 'Creates and registers CLAMM and Stableswap pools' },
    { name: 'DEX Router', address: GIWA_DEX_ROUTER, desc: 'Multi-hop swap and liquidity routing' },
    { name: 'CLAMM Deployer', address: GIWA_DEX_CL_DEPLOYER, desc: 'Concentrated Liquidity AMM deployer' },
    { name: 'Stableswap Deployer', address: GIWA_DEX_STABLE_DEPLOYER, desc: 'Curve-style amplification stableswap deployer' },
    { name: 'L2 Standard Bridge', address: GIWA_L2_STANDARD_BRIDGE, desc: 'OP Stack L2 Standard Token Bridge' },
    { name: 'L1 Standard Bridge', address: GIWA_L1_STANDARD_BRIDGE, desc: 'Sepolia L1 to Giwa L2 Bridge' },
    { name: 'Multicall3', address: GIWA_MULTICALL3, desc: 'High-performance batch call aggregator' },
    { name: 'Wrapped ETH (WETH)', address: GIWA_WETH, desc: 'Canonical Wrapped Ether on Giwa' },
    { name: 'USDC (Testnet)', address: USDC_ADDRESS, desc: 'USD Coin testnet token' },
    { name: 'KRWC (Testnet)', address: KRWC_ADDRESS, desc: 'Korean Won Coin testnet token' },
    { name: 'EURC (Testnet)', address: EURC_ADDRESS, desc: 'Euro Coin testnet token' },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          padding: isMobile ? 20 : 32,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'oklch(0.6724 0.1308 38.7559 / 0.15)',
              color: 'var(--primary)',
              fontSize: 12,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Zap size={14} />
            GIWA SEPOLIA (CHAIN ID 91342)
          </div>
          <span
            style={{
              fontSize: 12,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'var(--muted)',
              color: 'var(--foreground)',
              fontWeight: 700,
            }}
          >
            OP Stack L2 · 0.2s Flashblocks
          </span>
        </div>

        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 6px 0' }}>
          {language === 'ko' ? 'GIWA 개발자 문서 & 연동 가이드' : 'GIWA Developer Documentation'}
        </div>

        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', maxWidth: 680, lineHeight: 1.5, margin: '0 0 16px 0' }}>
          {language === 'ko'
            ? '스마트 컨트랙트 배포, DEX 풀 연동 및 SDK 가이드를 확인하세요.'
            : 'Deploy ERC-20 tokens, integrate DEX liquidity pools, and interact with GIWA L2 smart contracts.'}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            onClick={handleAddNetwork}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 16px oklch(0.6724 0.1308 38.7559 / 0.35)',
            }}
          >
            <Sparkles size={16} />
            {language === 'ko' ? '+ 지갑에 Giwa 네트워크 추가' : '+ Add Giwa to MetaMask'}
          </button>

          <button
            onClick={onNavigateToDeployer}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              background: 'var(--muted)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Coins size={16} />
            {language === 'ko' ? '1-클릭 토큰 발행기 열기' : 'Launch 1-Click Token Deployer'}
          </button>
        </div>
      </div>

      {/* Main Nav Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: 10,
        }}
      >
        {[
          { id: 'quickstart' as const, label: language === 'ko' ? '1. 네트워크 사양' : '1. Quickstart & RPC', icon: Zap },
          { id: 'token-guide' as const, label: language === 'ko' ? '2. 토큰 생성 가이드' : '2. Create Token', icon: FileCode2 },
          { id: 'dex-guide' as const, label: language === 'ko' ? '3. DEX 풀 & 유동성' : '3. Pools & Liquidity', icon: Droplets },
          { id: 'contracts' as const, label: language === 'ko' ? '4. 배포 컨트랙트 목록' : '4. Contract Registry', icon: Terminal },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            style={{
              padding: '14px 16px',
              borderRadius: 14,
              border: activeSection === id ? '1px solid var(--primary)' : '1px solid var(--border)',
              background: activeSection === id ? 'oklch(0.6724 0.1308 38.7559 / 0.12)' : 'var(--card)',
              color: activeSection === id ? 'var(--foreground)' : 'var(--muted-foreground)',
              fontSize: 13,
              fontWeight: activeSection === id ? 800 : 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <Icon size={16} color={activeSection === id ? 'var(--primary)' : 'currentColor'} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* SECTION 1: QUICKSTART & RPC CONFIG */}
      {activeSection === 'quickstart' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: isMobile ? 18 : 24,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 16px 0' }}>
              {language === 'ko' ? 'Giwa Sepolia 네트워크 파라미터' : 'GIWA Sepolia Network Parameters'}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Network Name', val: 'GIWA Sepolia Testnet' },
                { label: 'Chain ID', val: '91342 (0x164ce)' },
                { label: 'Currency Symbol', val: 'ETH (18 decimals)' },
                { label: 'Flashblocks RPC (200ms)', val: GIWA_FLASHBLOCKS_RPC },
                { label: 'Standard RPC', val: GIWA_STANDARD_RPC },
                { label: 'WebSocket RPC', val: 'wss://sepolia-rpc-flashblocks.giwa.io/ws' },
                { label: 'Block Explorer', val: 'https://sepolia-explorer.giwa.io' },
                { label: 'Layer 1 Parent Chain', val: 'Ethereum Sepolia (Chain ID 11155111)' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'var(--muted)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>{item.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', wordBreak: 'break-all' }}>
                      {item.val}
                    </span>
                    <button
                      onClick={() => copyText(item.val, `net-${idx}`)}
                      title="Copy"
                      style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 2 }}
                    >
                      {copiedKey === `net-${idx}` ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: TOKEN CREATION GUIDE */}
      {activeSection === 'token-guide' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Method A: 1-Click UI */}
          <div
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: isMobile ? 18 : 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                A
              </span>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
                {language === 'ko' ? '방법 1: 1-클릭 노코드 토큰 생성기 (추천)' : 'Method 1: 1-Click No-Code Deployer (Recommended)'}
              </h2>
            </div>

            <p style={{ fontSize: 13.5, color: 'var(--muted-foreground)', lineHeight: 1.6, margin: '0 0 16px 0' }}>
              {language === 'ko'
                ? '코딩이나 컴파일러 없이 HanokSwap 토큰 배포기에서 토큰명, 심볼, 총 발행량을 입력하고 "토큰 배포" 버튼을 클릭하면 지갑 서명 1번으로 Giwa Sepolia에 즉시 배포됩니다.'
                : 'Deploy custom ERC-20 tokens directly onto Giwa Sepolia with 1 click. Enter your Token Name, Symbol, Decimals, and Initial Supply — your browser wallet compiles and deploys the contract in seconds.'}
            </p>

            <button
              onClick={onNavigateToDeployer}
              style={{
                padding: '12px 20px',
                borderRadius: 12,
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                fontSize: 13.5,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Coins size={16} />
              {language === 'ko' ? '토큰 생성기 열기 (GiwaTokenDeployer)' : 'Open Token Deployer'}
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Method B: Code / Smart Contract */}
          <div
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: isMobile ? 18 : 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                B
              </span>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
                {language === 'ko' ? '방법 2: 스마트 컨트랙트 코드 작성 & 배포' : 'Method 2: Programmatic Contract Deployment'}
              </h2>
            </div>

            {/* Code sub-tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {(['solidity', 'foundry', 'hardhat', 'viem'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCodeTab(tab)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    border: codeTab === tab ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: codeTab === tab ? 'var(--primary)' : 'var(--muted)',
                    color: codeTab === tab ? '#fff' : 'var(--foreground)',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Code Box */}
            <div
              style={{
                position: 'relative',
                background: '#0d1117',
                borderRadius: 14,
                border: '1px solid var(--border)',
                padding: 16,
                overflowX: 'auto',
              }}
            >
              <button
                onClick={() => {
                  const txt =
                    codeTab === 'solidity'
                      ? solidityCode
                      : codeTab === 'foundry'
                      ? foundryCode
                      : codeTab === 'hardhat'
                      ? hardhatCode
                      : viemCode;
                  copyText(txt, `code-${codeTab}`);
                }}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {copiedKey === `code-${codeTab}` ? <Check size={12} color="#22c55e" /> : <Copy size={12} />}
                <span>{copiedKey === `code-${codeTab}` ? 'Copied' : 'Copy'}</span>
              </button>

              <pre style={{ margin: 0, fontSize: 12.5, fontFamily: 'var(--font-mono, monospace)', color: '#c9d1d9', lineHeight: 1.5 }}>
                <code>
                  {codeTab === 'solidity' && solidityCode}
                  {codeTab === 'foundry' && foundryCode}
                  {codeTab === 'hardhat' && hardhatCode}
                  {codeTab === 'viem' && viemCode}
                </code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: DEX POOLS & LIQUIDITY GUIDE */}
      {activeSection === 'dex-guide' && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: isMobile ? 18 : 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
            {language === 'ko' ? 'Giwa DEX 풀 개설 및 유동성 공급' : 'Creating Pools & Supplying Liquidity'}
          </h2>

          <p style={{ fontSize: 13.5, color: 'var(--muted-foreground)', lineHeight: 1.6, margin: 0 }}>
            {language === 'ko'
              ? '생성한 토큰을 사용자들이 스왑할 수 있도록 Giwa DEX Factory를 통해 CLAMM(집중 유동성) 또는 Stableswap 풀을 개설하고 유동성을 공급할 수 있습니다.'
              : 'After creating a token, create a liquidity pool on Giwa DEX using either Concentrated Liquidity (CLAMM) for volatile pairs or Stableswap for pegged pairs.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
            <div
              style={{
                padding: 16,
                borderRadius: 14,
                background: 'var(--muted)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>
                1. Concentrated CLAMM (Uni V3 Model)
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', lineHeight: 1.5, margin: 0 }}>
                {language === 'ko'
                  ? 'WETH/USDC, 토큰/ETH 등 가격 변동성이 있는 자산 쌍에 최적화된 높은 자본 효율성의 유동성 풀입니다.'
                  : 'Best for volatile pairs (e.g. YOUR_TOKEN / ETH). Allows custom price tick ranges for max capital efficiency.'}
              </p>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 14,
                background: 'var(--muted)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>
                2. Stableswap (Curve Model)
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', lineHeight: 1.5, margin: 0 }}>
                {language === 'ko'
                  ? 'USDC/KRWC/EURC 등 스테이블코인 및 고정 가치 자산 쌍에 최적화되어 슬리피지가 거의 없는 풀입니다.'
                  : 'Amplified liquidity curve with virtually zero slippage, engineered for stablecoins and pegged assets.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              onClick={onNavigateToPools}
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {language === 'ko' ? '유동성 풀 관리 화면으로 이동' : 'Go to Liquidity Pools'}
            </button>
            <button
              onClick={onNavigateToSwap}
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                background: 'var(--muted)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {language === 'ko' ? '스왑 화면으로 이동' : 'Go to Swap'}
            </button>
          </div>
        </div>
      )}

      {/* SECTION 4: DEPLOYED SMART CONTRACTS LIST */}
      {activeSection === 'contracts' && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: isMobile ? 18 : 24,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
              {language === 'ko' ? 'Giwa Sepolia 배포 컨트랙트 목록' : 'GIWA Sepolia Deployed Contracts'}
            </h2>
            <a
              href="https://sepolia-explorer.giwa.io"
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 12,
                color: 'var(--primary)',
                textDecoration: 'none',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Giwa Explorer <ExternalLink size={12} />
            </a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contractsList.map((c, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--muted)',
                  border: '1px solid var(--border)',
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{c.desc}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)', color: 'var(--primary)', background: 'var(--card)', padding: '4px 8px', borderRadius: 6 }}>
                    {c.address.slice(0, 8)}...{c.address.slice(-6)}
                  </code>
                  <button
                    onClick={() => copyText(c.address, `addr-${i}`)}
                    title="Copy Address"
                    style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 4 }}
                  >
                    {copiedKey === `addr-${i}` ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                  </button>
                  <a
                    href={`https://sepolia-explorer.giwa.io/address/${c.address}`}
                    target="_blank"
                    rel="noreferrer"
                    title="View on Explorer"
                    style={{ color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center' }}
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
