import { useState, useEffect } from 'react';
import type { EIP1193Provider, Address } from 'viem';
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  parseUnits,
} from 'viem';
import { giwaSepolia, GIWA_FLASHBLOCKS_RPC } from '../chains';
import { showToast } from '../toast';
import { useLanguage } from '../LanguageContext';
import { useIsMobile } from '../useIsMobile';
import { waitForSuccess } from '../txHelpers';
import {
  saveDeployedToken,
  getSavedDeployedTokens,
  type DeployedTokenRecord,
  STANDARD_ERC20_ABI,
  STANDARD_ERC20_BYTECODE,
  ANTI_SNIPE_TOKEN_ABI,
  ANTI_SNIPE_TOKEN_BYTECODE,
} from '../lib/tokenFactory';
import {
  Coins,
  ShieldCheck,
  Zap,
  ExternalLink,
  Copy,
  Check,
  Droplet,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface Props {
  provider?: EIP1193Provider;
  address?: string;
  onNavigateToPools?: () => void;
  onNavigateToDocs?: () => void;
}

type TokenType = 'STANDARD' | 'ANTI_SNIPE';

export default function GiwaTokenDeployer({ provider, address, onNavigateToPools }: Props) {
  const isMobile = useIsMobile();
  const { language } = useLanguage();

  const [tokenType, setTokenType] = useState<TokenType>('STANDARD');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [decimals, setDecimals] = useState<number>(18);
  const [supply, setSupply] = useState<string>('1000000');
  
  // Anti-snipe settings
  const [maxWalletBps, setMaxWalletBps] = useState<number>(100); // 1%
  const [maxTxBps, setMaxTxBps] = useState<number>(50); // 0.5%
  
  const [isDeploying, setIsDeploying] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [recentToken, setRecentToken] = useState<DeployedTokenRecord | null>(null);
  const [myTokens, setMyTokens] = useState<DeployedTokenRecord[]>([]);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const publicClient = createPublicClient({
    chain: giwaSepolia,
    transport: http(GIWA_FLASHBLOCKS_RPC),
  });

  useEffect(() => {
    setMyTokens(getSavedDeployedTokens(address));
  }, [address]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddr(text);
    setTimeout(() => setCopiedAddr(null), 2000);
    showToast(language === 'ko' ? '주소가 복사되었습니다' : 'Address copied to clipboard', 'info');
  };

  const handleAddTokenToWallet = async (token: DeployedTokenRecord) => {
    if (!provider) {
      showToast(language === 'ko' ? '지갑을 먼저 연결해주세요' : 'Please connect your wallet first', 'error');
      return;
    }
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
        } as any,
      });
      showToast(language === 'ko' ? '지갑에 토큰이 추가되었습니다!' : 'Token added to wallet!', 'success');
    } catch (err) {
      console.warn(err);
    }
  };

  const handleDeployToken = async () => {
    if (!provider || !address) {
      showToast(language === 'ko' ? '지갑을 연결해야 토큰을 배포할 수 있습니다.' : 'Connect your wallet to deploy on GIWA Sepolia', 'error');
      return;
    }
    if (!name.trim()) {
      showToast(language === 'ko' ? '토큰 이름을 입력하세요' : 'Enter token name', 'error');
      return;
    }
    if (!symbol.trim()) {
      showToast(language === 'ko' ? '토큰 심볼을 입력하세요' : 'Enter token symbol', 'error');
      return;
    }
    if (!supply || parseFloat(supply) <= 0) {
      showToast(language === 'ko' ? '발행 수량을 올바르게 입력하세요' : 'Enter a valid initial supply', 'error');
      return;
    }

    try {
      setIsDeploying(true);
      setStatusMsg(language === 'ko' ? '트랜잭션 서명 대기 중...' : 'Waiting for wallet confirmation...');

      const walletClient = createWalletClient({
        account: address as Address,
        chain: giwaSepolia,
        transport: custom(provider),
      });

      let deployHash: `0x${string}`;

      if (tokenType === 'STANDARD') {
        setStatusMsg(language === 'ko' ? 'GIWA Sepolia에 표준 ERC-20 스마트 컨트랙트 배포 중...' : 'Deploying standard ERC-20 on GIWA Sepolia...');
        
        deployHash = await walletClient.deployContract({
          abi: STANDARD_ERC20_ABI,
          bytecode: STANDARD_ERC20_BYTECODE,
          args: [name.trim(), symbol.trim().toUpperCase(), decimals],
        });
      } else {
        setStatusMsg(language === 'ko' ? 'GIWA Sepolia에 안티스나이퍼 런치 토큰 배포 중...' : 'Deploying Anti-Snipe Launch Token on GIWA Sepolia...');
        
        const initialSupplyBigInt = BigInt(Math.floor(parseFloat(supply)));
        const zeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

        deployHash = await walletClient.deployContract({
          abi: ANTI_SNIPE_TOKEN_ABI,
          bytecode: ANTI_SNIPE_TOKEN_BYTECODE,
          args: [
            name.trim(),
            symbol.trim().toUpperCase(),
            decimals,
            initialSupplyBigInt,
            BigInt(maxWalletBps),
            BigInt(maxTxBps),
            zeroBytes32,
          ],
        });
      }

      setStatusMsg(language === 'ko' ? '200ms Flashblocks 컨펌 대기 중...' : 'Confirming on GIWA Sepolia Flashblocks...');
      
      const receipt = await waitForSuccess(publicClient, deployHash);
      const contractAddress = receipt.contractAddress;

      if (!contractAddress) {
        throw new Error('Contract address not found in transaction receipt');
      }

      // If standard token, mint initial supply to deployer
      if (tokenType === 'STANDARD') {
        setStatusMsg(language === 'ko' ? '발행자 주소로 초기 공급량 민팅 중...' : 'Minting initial supply to deployer...');
        const mintAmount = parseUnits(supply, decimals);
        const mintHash = await walletClient.writeContract({
          address: contractAddress,
          abi: STANDARD_ERC20_ABI,
          functionName: 'mint',
          args: [address as Address, mintAmount],
        });
        await waitForSuccess(publicClient, mintHash);
      }

      const record: DeployedTokenRecord = {
        address: contractAddress,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        decimals,
        initialSupply: supply,
        type: tokenType,
        txHash: deployHash,
        deployer: address as Address,
        timestamp: Date.now(),
        hasFaucet: tokenType === 'STANDARD',
      };

      saveDeployedToken(record);
      setRecentToken(record);
      setMyTokens(getSavedDeployedTokens(address));

      showToast(
        language === 'ko'
          ? `$${record.symbol} 토큰이 GIWA Sepolia에 성공적으로 배포되었습니다!`
          : `$${record.symbol} successfully deployed on GIWA Sepolia!`,
        'success'
      );

      // Reset fields
      setName('');
      setSymbol('');
      setSupply('1000000');
    } catch (err: unknown) {
      console.error('Deploy error:', err);
      showToast(err instanceof Error ? err.message : 'Deployment failed', 'error');
    } finally {
      setIsDeploying(false);
      setStatusMsg('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: isMobile ? '100%' : 780, margin: '0 auto' }}>
      
      {/* Network & Live Status Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: 'var(--primary)', color: '#FFFFFF', letterSpacing: '0.02em' }}>
            GIWA SEPOLIA TOKEN DEPLOYER
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={13} color="var(--primary)" />
            <span>Chain ID: 91342 (200ms Flashblocks)</span>
          </span>
        </div>
      </div>

      {/* Deploy Success Card (If newly deployed) */}
      {recentToken && (
        <div className="uniswap-card" style={{ padding: '1.5rem', border: '1px solid rgba(34, 197, 94, 0.4)', background: 'rgba(34, 197, 94, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>
              <Check size={18} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--foreground)' }}>
                {language === 'ko' ? '토큰 배포 완료!' : 'Token Deployed Successfully!'}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>
                ${recentToken.symbol} ({recentToken.name}) · {parseFloat(recentToken.initialSupply).toLocaleString()} Supply
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--input)', padding: '12px 16px', borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600 }}>Contract Address:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', color: 'var(--foreground)', fontWeight: 700 }}>
                  {recentToken.address}
                </span>
                <button
                  onClick={() => copyToClipboard(recentToken.address)}
                  style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Copy"
                >
                  {copiedAddr === recentToken.address ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <a
              href={`https://sepolia-explorer.giwa.io/address/${recentToken.address}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 10,
                background: 'var(--secondary)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
                fontSize: 12.5,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <span>{language === 'ko' ? 'GIWA 익스플로러 보기' : 'View on Explorer'}</span>
              <ExternalLink size={13} />
            </a>

            <button
              onClick={() => handleAddTokenToWallet(recentToken)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 10,
                background: 'var(--secondary)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Coins size={13} color="var(--primary)" />
              <span>{language === 'ko' ? '지갑에 추가' : 'Add to Wallet'}</span>
            </button>

            {onNavigateToPools && (
              <button
                onClick={onNavigateToPools}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 10,
                  background: 'var(--primary)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                <Droplet size={13} />
                <span>{language === 'ko' ? 'DEX 풀 생성하기' : 'Create DEX Pool'}</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Token Deployer Form Card */}
      <div className="uniswap-card" style={{ padding: isMobile ? '1.5rem 1.25rem' : '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', marginBottom: 4 }}>
            {language === 'ko' ? '새 토큰 생성 & 배포' : 'Create & Deploy Real Token'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            {language === 'ko'
              ? 'GIWA Sepolia 스마트 컨트랙트로 실시간 배포되어 즉시 HanokSwap 풀 및 거래가 가능합니다.'
              : 'Deploy a real smart contract directly on GIWA Sepolia Layer 2 with instant DEX pool compatibility.'}
          </p>
        </div>

        {/* Token Standard Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: '1.5rem' }}>
          <button
            onClick={() => setTokenType('STANDARD')}
            style={{
              padding: '1rem',
              borderRadius: 16,
              border: tokenType === 'STANDARD' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
              background: tokenType === 'STANDARD' ? 'var(--accent)' : 'var(--input)',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: tokenType === 'STANDARD' ? 'var(--primary)' : 'var(--foreground)' }}>
                Standard ERC-20
              </span>
              <Coins size={16} color={tokenType === 'STANDARD' ? 'var(--primary)' : 'var(--muted-foreground)'} />
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
              {language === 'ko'
                ? '표준 공급량 민팅 + 테스트넷 Faucet 내장. 빠르고 유연한 테스트용 토큰.'
                : '100% supply minted to deployer + built-in testnet faucet for testing.'}
            </span>
          </button>

          <button
            onClick={() => setTokenType('ANTI_SNIPE')}
            style={{
              padding: '1rem',
              borderRadius: 16,
              border: tokenType === 'ANTI_SNIPE' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
              background: tokenType === 'ANTI_SNIPE' ? 'var(--accent)' : 'var(--input)',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: tokenType === 'ANTI_SNIPE' ? 'var(--primary)' : 'var(--foreground)' }}>
                Anti-Snipe Launch Token
              </span>
              <ShieldCheck size={16} color={tokenType === 'ANTI_SNIPE' ? 'var(--primary)' : 'var(--muted-foreground)'} />
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
              {language === 'ko'
                ? '최대 지갑 한도(1%) + 최대 거래 한도(0.5%) + 30초 쿨다운으로 봇 스나이핑 방어.'
                : 'Built-in 1% Max-Wallet, 0.5% Max-TX limits & 30s block anti-sniper cooldown.'}
            </span>
          </button>
        </div>

        {/* Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>
                {language === 'ko' ? '토큰 이름 (Name)' : 'Token Name'}
              </label>
              <div className="uniswap-input-box" style={{ padding: '0.75rem 1rem' }}>
                <input
                  type="text"
                  placeholder="e.g. Hanok Finance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--foreground)', fontSize: 14, fontWeight: 600 }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>
                {language === 'ko' ? '토큰 심볼 (Symbol)' : 'Token Symbol'}
              </label>
              <div className="uniswap-input-box" style={{ padding: '0.75rem 1rem' }}>
                <input
                  type="text"
                  placeholder="e.g. HANOK"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--foreground)', fontSize: 14, fontWeight: 700, textTransform: 'uppercase' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>
                {language === 'ko' ? '초기 발행 수량 (Initial Supply)' : 'Initial Supply'}
              </label>
              <div className="uniswap-input-box" style={{ padding: '0.75rem 1rem' }}>
                <input
                  type="text"
                  placeholder="1000000"
                  value={supply}
                  onChange={(e) => setSupply(e.target.value.replace(/[^0-9]/g, ''))}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--foreground)', fontSize: 14, fontWeight: 600 }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>
                {language === 'ko' ? '소수점 (Decimals)' : 'Decimals'}
              </label>
              <div className="uniswap-input-box" style={{ padding: '0.75rem 1rem' }}>
                <input
                  type="number"
                  value={decimals}
                  onChange={(e) => setDecimals(parseInt(e.target.value) || 18)}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--foreground)', fontSize: 14, fontWeight: 600 }}
                />
              </div>
            </div>
          </div>

          {/* Anti-Snipe Extra Settings */}
          {tokenType === 'ANTI_SNIPE' && (
            <div style={{ background: 'var(--secondary)', padding: '1.25rem', borderRadius: 14, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                <ShieldCheck size={16} />
                <span>Anti-Snipe Guard Parameters</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                <div>
                  <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>Max Wallet Limit:</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { label: '1.0%', val: 100 },
                      { label: '2.0%', val: 200 },
                      { label: '5.0%', val: 500 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setMaxWalletBps(opt.val)}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: 8,
                          border: maxWalletBps === opt.val ? '1px solid var(--primary)' : '1px solid var(--border)',
                          background: maxWalletBps === opt.val ? 'var(--accent)' : 'var(--input)',
                          color: maxWalletBps === opt.val ? 'var(--primary)' : 'var(--foreground)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 6 }}>
                    Limit: {((parseFloat(supply || '0') * maxWalletBps) / 10000).toLocaleString()} ${symbol || 'TOK'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)', display: 'block', marginBottom: 6 }}>Max TX Limit:</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { label: '0.5%', val: 50 },
                      { label: '1.0%', val: 100 },
                      { label: '2.0%', val: 200 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setMaxTxBps(opt.val)}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: 8,
                          border: maxTxBps === opt.val ? '1px solid var(--primary)' : '1px solid var(--border)',
                          background: maxTxBps === opt.val ? 'var(--accent)' : 'var(--input)',
                          color: maxTxBps === opt.val ? 'var(--primary)' : 'var(--foreground)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 6 }}>
                    Limit: {((parseFloat(supply || '0') * maxTxBps) / 10000).toLocaleString()} ${symbol || 'TOK'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Deploy CTA Button */}
          <button
            onClick={handleDeployToken}
            disabled={isDeploying}
            className="uniswap-btn-primary"
            style={{
              padding: '1rem',
              fontSize: 15,
              fontWeight: 800,
              cursor: isDeploying ? 'not-allowed' : 'pointer',
              opacity: isDeploying ? 0.7 : 1,
              marginTop: 6,
            }}
          >
            {isDeploying ? (statusMsg || 'Deploying Contract on GIWA...') : (language === 'ko' ? 'GIWA Sepolia에 토큰 배포하기' : 'Deploy Token on GIWA Sepolia')}
          </button>
        </div>
      </div>

      {/* Previously Deployed Tokens By User */}
      {myTokens.length > 0 && (
        <div className="uniswap-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} color="var(--primary)" />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>
                {language === 'ko' ? '내 배포된 토큰 목록' : 'My Deployed Tokens on GIWA'}
              </h3>
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600 }}>
              {myTokens.length} {myTokens.length === 1 ? 'Token' : 'Tokens'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myTokens.map((t) => (
              <div
                key={t.address}
                style={{
                  background: 'var(--input)',
                  padding: '12px 16px',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--foreground)' }}>
                      ${t.symbol}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                      {t.name}
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: t.type === 'ANTI_SNIPE' ? 'rgba(255, 90, 54, 0.15)' : 'var(--secondary)', color: t.type === 'ANTI_SNIPE' ? 'var(--primary)' : 'var(--muted-foreground)' }}>
                      {t.type}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)', marginTop: 4 }}>
                    {t.address}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => copyToClipboard(t.address)}
                    style={{ background: 'var(--secondary)', border: '1px solid var(--border)', padding: '6px 10px', borderRadius: 8, color: 'var(--foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600 }}
                  >
                    {copiedAddr === t.address ? <Check size={12} color="#22c55e" /> : <Copy size={12} />}
                    <span>{copiedAddr === t.address ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={() => handleAddTokenToWallet(t)}
                    style={{ background: 'var(--secondary)', border: '1px solid var(--border)', padding: '6px 10px', borderRadius: 8, color: 'var(--foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600 }}
                  >
                    <Coins size={12} color="var(--primary)" />
                    <span>Wallet</span>
                  </button>

                  <a
                    href={`https://sepolia-explorer.giwa.io/address/${t.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: 'var(--secondary)', border: '1px solid var(--border)', padding: '6px 10px', borderRadius: 8, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, textDecoration: 'none' }}
                  >
                    <span>Explorer</span>
                    <ExternalLink size={12} />
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
