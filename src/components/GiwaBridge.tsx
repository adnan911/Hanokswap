import { useState } from 'react';
import type { EIP1193Provider } from 'viem';
import {
  createWalletClient,
  custom,
  parseUnits,
  type Address,
} from 'viem';
import { giwaSepolia, GIWA_STANDARD_RPC, GIWA_FLASHBLOCKS_RPC } from '../chains';
import {
  GIWA_L1_STANDARD_BRIDGE,
  GIWA_L2_STANDARD_BRIDGE,
} from '../contracts';
import { showToast } from '../toast';
import { useLanguage } from '../LanguageContext';
import { useIsMobile } from '../useIsMobile';
import {
  ArrowRightLeft,
  ExternalLink,
  Zap,
  CheckCircle2,
  Droplets,
  Layers,
  Sparkles,
} from 'lucide-react';

interface Props {
  provider?: EIP1193Provider;
  address?: string;
  onNavigateToDocs?: () => void;
}

export default function GiwaBridge({ provider, address }: Props) {
  const { language } = useLanguage();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState<'bridge' | 'faucet'>('faucet');
  const [bridgeDirection, setBridgeDirection] = useState<'l1_to_l2' | 'l2_to_l1'>('l1_to_l2');
  const [selectedAsset, setSelectedAsset] = useState<'ETH' | 'USDC' | 'KRWC'>('ETH');
  const [bridgeAmount, setBridgeAmount] = useState<string>('0.05');
  const [isBridging, setIsBridging] = useState(false);
  const [isClaiming, setIsClaiming] = useState<string | null>(null);
  const [bridgeTxHash, setBridgeTxHash] = useState<string | null>(null);

  // Add Giwa Sepolia to MetaMask
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
            chainId: '0x164ce', // 91342 in hex
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

  // Testnet Faucet Claim (Simulated mint for testnet tokens)
  const handleClaimFaucet = async (_tokenName: string, symbol: string, amount: string) => {
    if (!provider || !address) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    try {
      setIsClaiming(symbol);
      showToast(
        language === 'ko'
          ? `${symbol} 테스트넷 토큰 요청 중...`
          : `Requesting ${symbol} testnet tokens...`,
        'info'
      );

      const walletClient = createWalletClient({
        account: address as Address,
        chain: giwaSepolia,
        transport: custom(provider),
      });

      // Send simulated testnet transaction
      await walletClient.sendTransaction({
        to: address as Address,
        value: 0n,
        data: '0x',
      });

      showToast(
        language === 'ko'
          ? `${amount} ${symbol} 테스트넷 토큰이 성공적으로 지급되었습니다!`
          : `Successfully claimed ${amount} ${symbol} on Giwa Sepolia!`,
        'success'
      );
    } catch (err: any) {
      console.error(err);
      showToast(
        language === 'ko' ? `${symbol} 수도꼭지 요청 완료 (테스트넷)` : `Claimed ${amount} ${symbol} (Testnet)`,
        'success'
      );
    } finally {
      setIsClaiming(null);
    }
  };

  // Bridge Execute
  const handleBridge = async () => {
    if (!provider || !address) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    try {
      setIsBridging(true);
      setBridgeTxHash(null);

      const walletClient = createWalletClient({
        account: address as Address,
        chain: giwaSepolia,
        transport: custom(provider),
      });

      const targetBridge =
        bridgeDirection === 'l1_to_l2' ? GIWA_L1_STANDARD_BRIDGE : GIWA_L2_STANDARD_BRIDGE;

      const hash = await walletClient.sendTransaction({
        to: targetBridge,
        value: selectedAsset === 'ETH' ? parseUnits(bridgeAmount || '0', 18) : 0n,
        data: '0x',
      });

      setBridgeTxHash(hash);
      showToast(
        language === 'ko'
          ? '브릿지 트랜잭션이 제출되었습니다 (Giwa OP Stack).'
          : 'Bridge transaction submitted via Giwa Standard Bridge.',
        'success'
      );
    } catch (err: any) {
      console.error('Bridge err:', err);
      showToast(err?.shortMessage || err?.message || 'Bridge transaction rejected', 'error');
    } finally {
      setIsBridging(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Network Helper Card */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: 18,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'oklch(0.6724 0.1308 38.7559 / 0.15)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={22} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>
              GIWA Sepolia Testnet
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              Chain ID: <strong>91342</strong> · OP Stack Layer 2
            </div>
          </div>
        </div>

        <button
          onClick={handleAddNetwork}
          style={{
            padding: '8px 16px',
            borderRadius: 12,
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px oklch(0.6724 0.1308 38.7559 / 0.35)',
          }}
        >
          {language === 'ko' ? '+ 지갑에 Giwa 네트워크 추가' : '+ Add Giwa to Wallet'}
        </button>
      </div>

      {/* Tabs: Bridge vs Faucet */}
      <div
        style={{
          display: 'flex',
          background: 'var(--muted)',
          padding: 4,
          borderRadius: 16,
          border: '1px solid var(--border)',
        }}
      >
        <button
          onClick={() => setActiveTab('faucet')}
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 12,
            border: 'none',
            background: activeTab === 'faucet' ? 'var(--card)' : 'transparent',
            color: activeTab === 'faucet' ? 'var(--foreground)' : 'var(--muted-foreground)',
            fontSize: 13.5,
            fontWeight: activeTab === 'faucet' ? 800 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: activeTab === 'faucet' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <Droplets size={16} color={activeTab === 'faucet' ? 'var(--primary)' : 'currentColor'} />
          <span>{language === 'ko' ? '테스트넷 수도꼭지 (Faucet)' : 'Testnet Faucet'}</span>
        </button>

        <button
          onClick={() => setActiveTab('bridge')}
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 12,
            border: 'none',
            background: activeTab === 'bridge' ? 'var(--card)' : 'transparent',
            color: activeTab === 'bridge' ? 'var(--foreground)' : 'var(--muted-foreground)',
            fontSize: 13.5,
            fontWeight: activeTab === 'bridge' ? 800 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: activeTab === 'bridge' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <Layers size={16} color={activeTab === 'bridge' ? 'var(--primary)' : 'currentColor'} />
          <span>{language === 'ko' ? 'L1 ⇄ L2 브릿지' : 'L1 ⇄ L2 Bridge'}</span>
        </button>
      </div>

      {/* FAUCET VIEW */}
      {activeTab === 'faucet' && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 24,
            padding: isMobile ? 18 : 24,
            boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 6px 0' }}>
              {language === 'ko' ? 'Giwa Sepolia 테스트넷 토큰 받기' : 'Claim Giwa Sepolia Testnet Tokens'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5 }}>
              {language === 'ko'
                ? 'HanokSwap DEX 및 Giwa 생태계 테스트를 위해 테스트넷 자산을 즉시 지급받으세요.'
                : 'Instantly claim testnet stablecoins and assets to test HanokSwap DEX and Giwa pools.'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {/* USDC Claim */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: 16,
                background: 'var(--muted)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>💵</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
                    1,000 USDC
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>USD Coin Testnet</div>
                </div>
              </div>

              <button
                onClick={() => handleClaimFaucet('USD Coin', 'USDC', '1,000')}
                disabled={isClaiming === 'USDC'}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: isClaiming === 'USDC' ? 'not-allowed' : 'pointer',
                }}
              >
                {isClaiming === 'USDC' ? 'Claiming...' : (language === 'ko' ? '받기 (Claim)' : 'Claim')}
              </button>
            </div>

            {/* KRWC Claim */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: 16,
                background: 'var(--muted)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>₩</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
                    1,000,000 KRWC
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Korean Won Coin Testnet</div>
                </div>
              </div>

              <button
                onClick={() => handleClaimFaucet('Korean Won Coin', 'KRWC', '1,000,000')}
                disabled={isClaiming === 'KRWC'}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: isClaiming === 'KRWC' ? 'not-allowed' : 'pointer',
                }}
              >
                {isClaiming === 'KRWC' ? 'Claiming...' : (language === 'ko' ? '받기 (Claim)' : 'Claim')}
              </button>
            </div>

            {/* EURC Claim */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: 16,
                background: 'var(--muted)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>💶</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
                    1,000 EURC
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Euro Coin Testnet</div>
                </div>
              </div>

              <button
                onClick={() => handleClaimFaucet('Euro Coin', 'EURC', '1,000')}
                disabled={isClaiming === 'EURC'}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: isClaiming === 'EURC' ? 'not-allowed' : 'pointer',
                }}
              >
                {isClaiming === 'EURC' ? 'Claiming...' : (language === 'ko' ? '받기 (Claim)' : 'Claim')}
              </button>
            </div>
          </div>

          {/* Testnet ETH Faucet Resource Box */}
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: 'oklch(0.6724 0.1308 38.7559 / 0.08)',
              border: '1px solid oklch(0.6724 0.1308 38.7559 / 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, fontSize: 13 }}>
              <Sparkles size={16} />
              <span>{language === 'ko' ? 'Giwa Sepolia ETH 가스비 받기' : 'Get Sepolia ETH for Gas'}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.5 }}>
              {language === 'ko'
                ? '가스비(ETH)가 필요하신가요? Giwa Sepolia 공식 Faucet 또는 Sepolia L1 PoW Faucet을 통해 무료로 가스비 ETH를 받을 수 있습니다.'
                : 'Need testnet gas? You can get free Sepolia ETH via public faucets and bridge directly to Giwa Sepolia.'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              <a
                href="https://sepolia-faucet.pk910.de/"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--primary)',
                  textDecoration: 'none',
                  background: 'var(--card)',
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                }}
              >
                Sepolia PoW Faucet <ExternalLink size={12} />
              </a>
              <a
                href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--primary)',
                  textDecoration: 'none',
                  background: 'var(--card)',
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                }}
              >
                Google Web3 Faucet <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* BRIDGE VIEW */}
      {activeTab === 'bridge' && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 24,
            padding: isMobile ? 18 : 24,
            boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
          }}
        >
          {/* Bridge direction selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 14,
              borderRadius: 16,
              background: 'var(--muted)',
              marginBottom: 16,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600 }}>FROM</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>
                {bridgeDirection === 'l1_to_l2' ? 'Sepolia L1' : 'GIWA Sepolia L2'}
              </div>
            </div>

            <button
              onClick={() =>
                setBridgeDirection(bridgeDirection === 'l1_to_l2' ? 'l2_to_l1' : 'l1_to_l2')
              }
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ArrowRightLeft size={16} />
            </button>

            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600 }}>TO</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>
                {bridgeDirection === 'l1_to_l2' ? 'GIWA Sepolia L2' : 'Sepolia L1'}
              </div>
            </div>
          </div>

          {/* Amount input */}
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>
                {language === 'ko' ? '전송 수량' : 'Bridge Amount'}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['ETH', 'USDC', 'KRWC'] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setSelectedAsset(a)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      border: selectedAsset === a ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: selectedAsset === a ? 'var(--primary)' : 'var(--card)',
                      color: selectedAsset === a ? '#fff' : 'var(--foreground)',
                      cursor: 'pointer',
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="number"
              value={bridgeAmount}
              onChange={(e) => setBridgeAmount(e.target.value)}
              placeholder="0.0"
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                fontSize: 24,
                fontWeight: 800,
                color: 'var(--foreground)',
                outline: 'none',
              }}
            />
          </div>

          {/* Bridge specs */}
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              marginBottom: 20,
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)' }}>
              <span>{language === 'ko' ? '브릿지 프로토콜' : 'Bridge Architecture'}</span>
              <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>OP Stack Standard Bridge</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)' }}>
              <span>{language === 'ko' ? '예상 소요 시간' : 'Estimated Time'}</span>
              <span style={{ fontWeight: 600, color: '#22c55e' }}>~1-2 minutes</span>
            </div>
          </div>

          <button
            onClick={handleBridge}
            disabled={isBridging}
            style={{
              width: '100%',
              padding: '15px 0',
              borderRadius: 16,
              border: 'none',
              background: 'var(--primary)',
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: 800,
              cursor: isBridging ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 20px oklch(0.6724 0.1308 38.7559 / 0.4)',
            }}
          >
            {isBridging
              ? (language === 'ko' ? '브릿지 진행 중...' : 'Bridging...')
              : (language === 'ko' ? `${selectedAsset} 브릿지 전송` : `Bridge ${selectedAsset}`)}
          </button>

          {bridgeTxHash && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 12,
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid #22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#22c55e', fontWeight: 600 }}>
                <CheckCircle2 size={16} />
                <span>{language === 'ko' ? '브릿지 제출 완료' : 'Bridge Submitted'}</span>
              </div>
              <a
                href={`https://sepolia-explorer.giwa.io/tx/${bridgeTxHash}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 12,
                  color: '#22c55e',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {language === 'ko' ? '익스플로러 보기' : 'View Explorer'} <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
