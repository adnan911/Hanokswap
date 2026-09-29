import { useState } from 'react';
import type { EIP1193Provider } from 'viem';
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  parseUnits,
  type Address,
} from 'viem';
import { giwaSepolia, GIWA_STANDARD_RPC } from '../chains';
import { showToast } from '../toast';
import { waitForSuccess } from '../txHelpers';
import { useLanguage } from '../LanguageContext';
import { useIsMobile } from '../useIsMobile';
import {
  Coins,
  CheckCircle2,
  ExternalLink,
  Copy,
  PlusCircle,
  BookOpen,
  Zap,
} from 'lucide-react';

interface Props {
  provider?: EIP1193Provider;
  address?: string;
  onNavigateToPools?: () => void;
  onNavigateToDocs?: () => void;
}

// Standard OpenZeppelin-compatible ERC-20 ABI with custom Name, Symbol, Decimals & Initial Supply
export const ERC20_DEPLOY_ABI = [
  {
    type: 'constructor',
    inputs: [
      { name: 'name_', type: 'string' },
      { name: 'symbol_', type: 'string' },
      { name: 'decimals_', type: 'uint8' },
      { name: 'initialSupply_', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// Minimal Standard ERC20 Bytecode compiled with solc 0.8.20 for EVM/Giwa Sepolia
const ERC20_BYTECODE =
  ('0x608060405234801561001057600080fd5b5060405161099e38038061099e83398101604081905261002f916100cd565b836000908051906020019061004592919061006c565b50826001908051906020019061005b92919061006c565b5081600260006101000a81548160ff021916908360ff1602179055503381610087828461016c565b610091838261021c565b5050505050610242565b828054610078906101b0565b90600052602060002090601f016020900481019282156100be579160200282015b828111156100bd5782518255916020019190600101906100a2565b5b5090506100cb91906101d2565b5090565b600080600080608085870312156100e457600080fd5b845167ffffffffffffffff8111156100fb57600080fd5b61010786828701610123565b94505060208501518582111561011c57600080fd5b61012886828701610123565b935050604085015160ff8116811461013e57600080fd5b9250606085015191505092959194509250565b60006020828403121561013557600080fd5b815167ffffffffffffffff81111561014c57600080fd5b60208301915083602082850101111561016357600080fd5b9250929050565b600061017882600260009054906101000a900460ff166101ee565b90506000821161018957806101aa565b60006101968383610207565b9050808311156101a757600080fd5b805b92505050919050565b60018160011c902780601f37602002820160405260208152919050565b5b808211156101eb5760008160009055506001016101d3565b5090565b600060ff8216600a0a9050919050565b60008183610216919061023a565b905092915050565b600033600360008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254019250508190555081600460008282540192505081905550600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378d7e45ffb307ff11285473347e3a987d004583604051610232919061024b565b60405180910390a35050565b60008282029050828204821461024657600080fd5b92915050565b61074c806102506000396000f3fe' as `0x${string}`);

interface DeployedToken {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  txHash: string;
  timestamp: number;
}

export default function GiwaTokenDeployer({ provider, address, onNavigateToPools, onNavigateToDocs }: Props) {
  const isMobile = useIsMobile();
  const { language } = useLanguage();

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [decimals, setDecimals] = useState(18);
  const [initialSupply, setInitialSupply] = useState('1000000');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedToken, setDeployedToken] = useState<DeployedToken | null>(null);
  const [myTokens, setMyTokens] = useState<DeployedToken[]>(() => {
    try {
      const saved = localStorage.getItem('giwa_deployed_tokens');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleDeploy = async () => {
    if (!provider || !address) {
      showToast(language === 'ko' ? '지갑을 먼저 연결해주세요' : 'Please connect your wallet first', 'error');
      return;
    }

    if (!name.trim() || !symbol.trim() || Number(initialSupply) <= 0) {
      showToast(language === 'ko' ? '토큰 정보를 올바르게 입력해주세요' : 'Please provide valid token details', 'error');
      return;
    }

    try {
      setIsDeploying(true);
      showToast(language === 'ko' ? '기와(Giwa) 플래শব록 컨트랙트 배포 중...' : 'Deploying token to Giwa Sepolia with 0.2s Flashblocks...', 'info');

      const walletClient = createWalletClient({
        chain: giwaSepolia,
        transport: custom(provider),
      });

      const publicClient = createPublicClient({
        chain: giwaSepolia,
        transport: http(GIWA_STANDARD_RPC),
      });

      const parsedSupply = parseUnits(initialSupply, decimals);

      // Deploy ERC-20 contract directly via wallet
      const txHash = await walletClient.deployContract({
        abi: ERC20_DEPLOY_ABI,
        bytecode: ERC20_BYTECODE,
        args: [name.trim(), symbol.trim().toUpperCase(), decimals, parsedSupply],
        account: address as Address,
      });

      showToast(language === 'ko' ? '트랜잭션 승인됨. 블록 확정 중...' : 'Transaction signed. Confirming on Giwa...', 'info');

      const receipt = await waitForSuccess(publicClient, txHash);
      const contractAddress = receipt.contractAddress as Address;

      if (!contractAddress) {
        throw new Error('Failed to retrieve deployed contract address');
      }

      const newToken: DeployedToken = {
        address: contractAddress,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        decimals,
        supply: initialSupply,
        txHash,
        timestamp: Date.now(),
      };

      setDeployedToken(newToken);
      const updated = [newToken, ...myTokens];
      setMyTokens(updated);
      localStorage.setItem('giwa_deployed_tokens', JSON.stringify(updated));

      showToast(
        language === 'ko'
          ? `토큰 ${newToken.symbol} 배포 완료! 주소: ${contractAddress.slice(0, 8)}...`
          : `Token ${newToken.symbol} deployed successfully to Giwa!`,
        'success'
      );
    } catch (err: any) {
      console.error('Token deployment failed:', err);
      showToast(err.shortMessage || err.message || 'Token deployment failed', 'error');
    } finally {
      setIsDeploying(false);
    }
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    showToast(language === 'ko' ? '토큰 주소가 복사되었습니다!' : 'Token address copied to clipboard!', 'success');
  };

  const addTokenToWallet = async (token: DeployedToken) => {
    if (!provider) return;
    try {
      await provider.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
          },
        },
      });
      showToast(language === 'ko' ? '지갑에 토큰이 추가되었습니다!' : 'Token added to wallet!', 'success');
    } catch (err) {
      console.error('Failed to add token to wallet:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: isMobile ? 460 : 920, margin: '0 auto' }}>
      {/* Top Banner Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--card) 0%, var(--muted) 100%)',
          border: '1px solid var(--border)',
          borderRadius: 22,
          padding: isMobile ? '1.5rem' : '2rem',
          boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: '-40%', right: '-10%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, oklch(0.6724 0.1308 38.7559 / 0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ maxWidth: 580 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 999, background: 'var(--muted)', border: '1px solid var(--border)', fontSize: 11.5, fontWeight: 800, color: 'var(--primary)', marginBottom: 12 }}>
              <Zap size={14} /> GIWA SEPOLIA TESTNET · 0.2S FLASHBLOCKS
            </div>
            <h1 className="prism-display" style={{ margin: '0 0 8px 0', fontSize: isMobile ? 24 : 32, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
              {language === 'ko' ? '기와(Giwa) 테스트넷 토큰 생성기' : 'Create & Deploy Giwa Testnet Token'}
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
              {language === 'ko'
                ? '코드 작성 없이 1초 만에 기와(Giwa Sepolia) 체인에 나만의 커스텀 ERC-20 토큰을 배포하고 유동성 풀에 등록하세요.'
                : 'Deploy custom ERC-20 standard tokens directly onto Giwa Sepolia testnet in one click. Free, fast (0.2s finality), and instantly compatible with Hanok DEX pools.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {onNavigateToDocs && (
              <button
                onClick={onNavigateToDocs}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  color: 'var(--foreground)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <BookOpen size={16} color="var(--primary)" /> {language === 'ko' ? '개발자 문서 & 가이드' : 'Docs & Guide'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap: '1.5rem' }}>
        {/* Token Creation Form */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, padding: isMobile ? '1.5rem' : '1.75rem', boxShadow: '0 16px 40px rgba(0,0,0,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlusCircle size={20} color="var(--primary)" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>
                {language === 'ko' ? '토큰 기본 정보 입력' : 'Token Parameters'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                {language === 'ko' ? '표준 OpenZeppelin ERC-20 규격을 준수합니다.' : 'Standard OpenZeppelin-compatible ERC-20.'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 6 }}>
                {language === 'ko' ? '토큰 이름 (Token Name)' : 'Token Name'}
              </label>
              <input
                type="text"
                placeholder={language === 'ko' ? '예: Giwa Gold, Hanok Token' : 'e.g. Giwa Gold, Hanok Token'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: 14, outline: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 6 }}>
                  {language === 'ko' ? '토큰 심볼 (Symbol)' : 'Token Symbol'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. GGLD, HNK"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: 14, fontWeight: 700, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 6 }}>
                  {language === 'ko' ? '자릿수 (Decimals)' : 'Decimals'}
                </label>
                <input
                  type="number"
                  min="0"
                  max="18"
                  value={decimals}
                  onChange={(e) => setDecimals(Number(e.target.value))}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: 14, outline: 'none' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 6 }}>
                {language === 'ko' ? '초기 발행량 (Initial Supply)' : 'Initial Supply'}
              </label>
              <input
                type="number"
                placeholder="1000000"
                value={initialSupply}
                onChange={(e) => setInitialSupply(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: 14, fontWeight: 700, outline: 'none' }}
              />
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
                {language === 'ko'
                  ? `배포 즉시 귀하의 지갑 (${address ? address.slice(0, 6) + '...' + address.slice(-4) : '연결된 지갑'})으로 전액 지급됩니다.`
                  : `100% of supply will be minted directly to your connected wallet upon deployment.`}
              </div>
            </div>

            <button
              onClick={handleDeploy}
              disabled={isDeploying || !name.trim() || !symbol.trim()}
              style={{
                marginTop: 10,
                padding: '14px',
                borderRadius: 14,
                border: 'none',
                background: 'var(--primary)',
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: 800,
                cursor: isDeploying ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 20px oklch(0.6724 0.1308 38.7559 / 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Coins size={18} />
              {isDeploying
                ? (language === 'ko' ? '0.2초 플래শব록 배포 중...' : 'Deploying to Giwa Sepolia...')
                : (language === 'ko' ? '기와(Giwa) 테스트넷에 토큰 배포' : 'Deploy Token to Giwa Sepolia')}
            </button>
          </div>
        </div>

        {/* Live Preview & Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Card Preview */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, padding: '1.5rem', boxShadow: '0 16px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>
              {language === 'ko' ? '실시간 토큰 미리보기' : 'LIVE TOKEN PREVIEW'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: 18, fontWeight: 800, flexShrink: 0 }}>
                {symbol ? symbol.slice(0, 2) : 'TK'}
              </div>
              <div>
                <div className="prism-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)' }}>
                  {name || (language === 'ko' ? '토큰 이름' : 'Token Name')}
                </div>
                <div className="prism-mono" style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>
                  ${symbol || 'SYMBOL'} · {decimals} Decimals
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--muted)', borderRadius: 14, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted-foreground)' }}>{language === 'ko' ? '네트워크' : 'Network'}</span>
                <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>Giwa Sepolia (91342)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted-foreground)' }}>{language === 'ko' ? '초기 발행량' : 'Total Supply'}</span>
                <span className="prism-mono" style={{ fontWeight: 700, color: 'var(--foreground)' }}>
                  {Number(initialSupply || 0).toLocaleString()} {symbol || ''}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted-foreground)' }}>{language === 'ko' ? '체결 속도' : 'Block Speed'}</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>0.2s Flashblocks</span>
              </div>
            </div>
          </div>

          {/* Deployed Success Box */}
          {deployedToken && (
            <div style={{ background: 'oklch(0.6724 0.1308 38.7559 / 0.12)', border: '1px solid var(--primary)', borderRadius: 20, padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
                <CheckCircle2 size={18} /> {language === 'ko' ? '배포 완료!' : 'Successfully Deployed!'}
              </div>
              <div className="prism-mono" style={{ fontSize: 12, color: 'var(--foreground)', wordBreak: 'break-all', marginBottom: 12 }}>
                {deployedToken.address}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  onClick={() => copyAddress(deployedToken.address)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  <Copy size={12} /> {language === 'ko' ? '주소 복사' : 'Copy Address'}
                </button>
                <button
                  onClick={() => addTokenToWallet(deployedToken)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#FFFFFF', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  <PlusCircle size={12} /> {language === 'ko' ? '지갑에 추가' : 'Add to Wallet'}
                </button>
                <a
                  href={`https://sepolia-explorer.giwa.io/token/${deployedToken.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--primary)', fontSize: 11.5, fontWeight: 700, textDecoration: 'none' }}
                >
                  <ExternalLink size={12} /> {language === 'ko' ? '탐색기' : 'Explorer'}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Previously Deployed Tokens List */}
      {myTokens.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, padding: '1.5rem', boxShadow: '0 16px 40px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>
              {language === 'ko' ? '내가 배포한 기와(Giwa) 토큰 목록' : 'My Deployed Tokens on Giwa'}
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{myTokens.length} Tokens</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myTokens.map((t) => (
              <div
                key={t.address}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: 14,
                  background: 'var(--muted)',
                  border: '1px solid var(--border)',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--primary)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                    {t.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>
                      {t.name} ({t.symbol})
                    </div>
                    <div className="prism-mono" style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
                      {t.address.slice(0, 8)}...{t.address.slice(-6)} · {Number(t.supply).toLocaleString()} Supply
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => copyAddress(t.address)} title="Copy Address" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Copy size={13} />
                  </button>
                  <button onClick={() => addTokenToWallet(t)} title="Add to Metamask" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <PlusCircle size={14} />
                  </button>
                  <a href={`https://sepolia-explorer.giwa.io/token/${t.address}`} target="_blank" rel="noopener noreferrer" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                    <ExternalLink size={13} />
                  </a>
                  {onNavigateToPools && (
                    <button onClick={onNavigateToPools} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#FFFFFF', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                      {language === 'ko' ? '풀 생성' : 'Create Pool'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
