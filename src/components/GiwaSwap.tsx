import { useState, useEffect, useMemo } from 'react';
import type { EIP1193Provider } from 'viem';
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  formatUnits,
  parseUnits,
  type Address,
} from 'viem';
import { giwaSepolia, GIWA_FLASHBLOCKS_RPC } from '../chains';
import {
  GIWA_DEX_ROUTER,
  GIWA_WETH,
  USDC_ADDRESS,
  EURC_ADDRESS,
  KRWC_ADDRESS,
  USYC_ADDRESS,
} from '../contracts';
import { showToast } from '../toast';
import { useLanguage } from '../LanguageContext';
import { useIsMobile } from '../useIsMobile';
import { computeSmartOrderRoute, type SORRoute } from '../lib/sor';
import { buildSwapParams, minimumSwapOutput, SWAP_ROUTER_ABI } from '../lib/swapExecution';
import { waitForSuccess } from '../txHelpers';
import {
  saveDEXLimitOrder,
  type DEXLimitOrder,
} from '../lib/limitOrders';
import {
  saveDEXDCAStream,
  type DEXDCAStream,
} from '../lib/dca';
import { TokenIcon } from './TokenIcon';
import {
  ArrowDownUp,
  Settings2,
  Zap,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  Search,
  X,
  Droplets,
} from 'lucide-react';

interface TokenItem {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  icon: string;
  isNative?: boolean;
}

const DEFAULT_TOKENS: TokenItem[] = [
  {
    symbol: 'ETH',
    name: 'Giwa Sepolia Ether',
    address: '0x0000000000000000000000000000000000000000' as Address,
    decimals: 18,
    icon: '⟠',
    isNative: true,
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: GIWA_WETH,
    decimals: 18,
    icon: '⚡',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin (Testnet)',
    address: USDC_ADDRESS,
    decimals: 6,
    icon: '💵',
  },
  {
    symbol: 'EURC',
    name: 'Euro Coin (Testnet)',
    address: EURC_ADDRESS,
    decimals: 6,
    icon: '💶',
  },
  {
    symbol: 'KRWC',
    name: 'Korean Won Coin (Testnet)',
    address: KRWC_ADDRESS,
    decimals: 6,
    icon: '₩',
  },
  {
    symbol: 'USYC',
    name: 'Yield USD (Testnet)',
    address: USYC_ADDRESS,
    decimals: 6,
    icon: '📈',
  },
];

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'faucet',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;

type TradingMode = 'MARKET' | 'LIMIT' | 'DCA';

interface Props {
  provider: EIP1193Provider | null;
  address: string | null;
  onConnect?: () => void;
  onNavigateToDeployer?: () => void;
}

export default function GiwaSwap({ provider, address, onConnect }: Props) {
  const { t, language } = useLanguage();
  const isMobile = useIsMobile();

  const [mode, setMode] = useState<TradingMode>('MARKET');
  const tokens = DEFAULT_TOKENS;
  const [fromToken, setFromToken] = useState<TokenItem>(DEFAULT_TOKENS[0]); // ETH
  const [toToken, setToToken] = useState<TokenItem>(DEFAULT_TOKENS[2]); // USDC
  const [fromAmount, setFromAmount] = useState<string>('0.1');
  const [slippage, setSlippage] = useState<number>(0.5);
  const [showSettings, setShowSettings] = useState(false);
  const [showFromModal, setShowFromModal] = useState(false);
  const [showToModal, setShowToModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false);

  // Limit Order parameters
  const [limitTargetPrice, setLimitTargetPrice] = useState<string>('3150.00');
  const [limitDurationDays, setLimitDurationDays] = useState<number>(7);

  // DCA parameters
  const [dcaFrequency, setDcaFrequency] = useState<'HOURLY' | 'DAILY' | 'WEEKLY'>('DAILY');
  const [dcaTotalOrders] = useState<number>(10);

  const [fromBalance, setFromBalance] = useState<string>('0.00');
  const [toBalance, setToBalance] = useState<string>('0.00');
  const [isSwapping, setIsSwapping] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const publicClient = createPublicClient({
    chain: giwaSepolia,
    transport: http(GIWA_FLASHBLOCKS_RPC),
  });

  const smartRoute: SORRoute = useMemo(() => {
    return computeSmartOrderRoute(
      fromToken.address,
      toToken.address,
      fromToken.symbol,
      toToken.symbol,
      fromAmount,
      slippage
    );
  }, [fromToken, toToken, fromAmount, slippage]);

  const toAmount = smartRoute.expectedAmountOut;

  const refreshBalances = async () => {
    if (!address) return;
    try {
      if (fromToken.isNative) {
        const bal = await publicClient.getBalance({ address: address as Address });
        setFromBalance(Number(formatUnits(bal, 18)).toFixed(4));
      } else {
        const bal = (await publicClient.readContract({
          address: fromToken.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address as Address],
        })) as bigint;
        setFromBalance(Number(formatUnits(bal, fromToken.decimals)).toFixed(2));
      }

      if (toToken.isNative) {
        const bal = await publicClient.getBalance({ address: address as Address });
        setToBalance(Number(formatUnits(bal, 18)).toFixed(4));
      } else {
        const bal = (await publicClient.readContract({
          address: toToken.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address as Address],
        })) as bigint;
        setToBalance(Number(formatUnits(bal, toToken.decimals)).toFixed(2));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshBalances();
    const interval = setInterval(refreshBalances, 10000);
    return () => clearInterval(interval);
  }, [address, fromToken, toToken]);

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount('0.1');
  };

  const handleClaimFaucet = async () => {
    if (!provider || !address) {
      if (onConnect) onConnect();
      else showToast(t.connectWallet, 'info');
      return;
    }
    try {
      setIsClaimingFaucet(true);
      const walletClient = createWalletClient({
        account: address as Address,
        chain: giwaSepolia,
        transport: custom(provider),
      });

      const tokenToClaim = fromToken.isNative ? USDC_ADDRESS : fromToken.address;
      showToast(language === 'ko' ? '1,000 테스트 토큰 요청 중...' : 'Requesting 1,000 test tokens...', 'info');

      const hash = await walletClient.writeContract({
        address: tokenToClaim,
        abi: ERC20_ABI,
        functionName: 'faucet',
        args: [],
      });

      await waitForSuccess(publicClient, hash);
      showToast(language === 'ko' ? '1,000 테스트 토큰 지급 완료!' : 'Claimed 1,000 test tokens successfully!', 'success');
      refreshBalances();
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Faucet claim failed', 'error');
    } finally {
      setIsClaimingFaucet(false);
    }
  };

  const executeMarketSwap = async () => {
    if (!provider || !address) {
      if (onConnect) onConnect();
      else showToast(t.connectWallet, 'info');
      return;
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      showToast(language === 'ko' ? '수량을 입력하세요.' : 'Please enter a valid amount', 'info');
      return;
    }

    try {
      setIsSwapping(true);
      setTxHash(null);

      const walletClient = createWalletClient({
        account: address as Address,
        chain: giwaSepolia,
        transport: custom(provider),
      });

      const parsedAmountIn = parseUnits(fromAmount, fromToken.decimals);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

      if (!fromToken.isNative) {
        const allowance = (await publicClient.readContract({
          address: fromToken.address,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address as Address, GIWA_DEX_ROUTER],
        })) as bigint;

        if (allowance < parsedAmountIn) {
          showToast(language === 'ko' ? '토큰 승인 요청 중...' : 'Approving token transfer...', 'info');
          const approveHash = await walletClient.writeContract({
            address: fromToken.address,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [GIWA_DEX_ROUTER, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
          });
          await waitForSuccess(publicClient, approveHash);
          showToast(language === 'ko' ? '토큰 승인 완료!' : 'Token approved successfully', 'success');
        }
      }

      showToast(language === 'ko' ? '스왑 트랜잭션 전송 중 (200ms)...' : 'Submitting swap (200ms Flashblocks)...', 'info');

      const expectedOutRaw = parseUnits(smartRoute.expectedAmountOut || '0', toToken.decimals);
      const minAmountOut = expectedOutRaw > 0n ? minimumSwapOutput(expectedOutRaw, slippage) : 1n;
      const params = buildSwapParams(smartRoute, address as Address, fromToken.decimals, deadline, minAmountOut);
      const hash = await walletClient.writeContract({
        address: GIWA_DEX_ROUTER,
        abi: SWAP_ROUTER_ABI,
        functionName: 'exactInputMultiHop',
        args: [params],
        value: fromToken.isNative ? params.amountIn : 0n,
      });

      setTxHash(hash);
      await waitForSuccess(publicClient, hash);

      showToast(language === 'ko' ? '스왑이 확정되었습니다!' : 'Swap confirmed on GIWA Sepolia!', 'success');
      refreshBalances();
    } catch (err: unknown) {
      console.error('Swap error:', err);
      showToast(err instanceof Error ? err.message : 'Swap execution failed', 'error');
    } finally {
      setIsSwapping(false);
    }
  };

  const handleCreateLimitOrder = async () => {
    if (!address) {
      if (onConnect) onConnect();
      return;
    }
    const order: DEXLimitOrder = {
      id: 'lo-' + Date.now(),
      maker: address as Address,
      tokenInAddress: fromToken.address,
      tokenOutAddress: toToken.address,
      tokenInSymbol: fromToken.symbol,
      tokenOutSymbol: toToken.symbol,
      amountIn: fromAmount,
      targetPriceUSD: parseFloat(limitTargetPrice || '0'),
      minAmountOut: toAmount,
      createdAt: Date.now(),
      expiresAt: Date.now() + limitDurationDays * 86400000,
      status: 'OPEN',
      isBuy: true,
    };
    saveDEXLimitOrder(order);
    showToast(language === 'ko' ? '지정가 주문이 등록되었습니다.' : 'Limit order placed successfully', 'success');
  };

  const handleCreateDCA = async () => {
    if (!address) {
      if (onConnect) onConnect();
      return;
    }
    const intervalMs = dcaFrequency === 'HOURLY' ? 3600000 : dcaFrequency === 'DAILY' ? 86400000 : 604800000;
    const stream: DEXDCAStream = {
      id: 'dca-' + Date.now(),
      owner: address as Address,
      tokenInAddress: fromToken.address,
      tokenOutAddress: toToken.address,
      tokenInSymbol: fromToken.symbol,
      tokenOutSymbol: toToken.symbol,
      totalAmountIn: (parseFloat(fromAmount || '0') * dcaTotalOrders).toString(),
      amountPerInterval: fromAmount,
      frequency: dcaFrequency,
      intervalSeconds: intervalMs / 1000,
      totalIntervals: dcaTotalOrders,
      intervalsCompleted: 0,
      createdAt: Date.now(),
      nextExecutionTime: Date.now() + intervalMs,
      status: 'ACTIVE',
    };
    saveDEXDCAStream(stream);
    showToast(language === 'ko' ? 'DCA 적립 스트림이 시작되었습니다.' : 'DCA stream started successfully', 'success');
  };

  const filteredTokens = tokens.filter(
    (t) =>
      t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isInsufficientBalance = parseFloat(fromAmount || '0') > parseFloat(fromBalance || '0');
  const isInputZero = !fromAmount || parseFloat(fromAmount) <= 0;

  const quotedOutputBigInt = parseUnits(toAmount || '0', toToken.decimals);
  const minimumOutputDisplay = quotedOutputBigInt > 0n
    ? formatUnits(minimumSwapOutput(quotedOutputBigInt, slippage), toToken.decimals)
    : '0.00';

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Mode Pill Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px',
          borderRadius: 9999,
          background: 'var(--card-solid, #131823)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          {(['MARKET', 'LIMIT', 'DCA'] as const).map((m) => {
            const active = mode === m;
            const label = m === 'MARKET' ? (language === 'ko' ? '스왑' : 'Swap') : m === 'LIMIT' ? (language === 'ko' ? '지정가' : 'Limit') : 'DCA';
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 9999,
                  border: 'none',
                  background: active ? 'var(--secondary)' : 'transparent',
                  color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 6 }}>
          <button
            onClick={refreshBalances}
            title="Refresh balance"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Swap settings"
            style={{
              background: showSettings ? 'var(--secondary)' : 'none',
              border: 'none',
              color: showSettings ? 'var(--primary)' : 'var(--muted-foreground)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {/* Main Uniswap Card */}
      <div className="uniswap-card" style={{ padding: isMobile ? 18 : 22, position: 'relative' }}>
        {/* Slippage Dropdown Drawer */}
        {showSettings && (
          <div
            style={{
              padding: 14,
              borderRadius: 14,
              background: 'var(--input)',
              border: '1px solid var(--border)',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>
                {t.slippageTolerance || 'Max Slippage'}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{slippage}%</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0.1, 0.5, 1.0].map((val) => (
                <button
                  key={val}
                  onClick={() => setSlippage(val)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 10,
                    border: slippage === val ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: slippage === val ? 'var(--accent)' : 'var(--secondary)',
                    color: slippage === val ? 'var(--primary)' : 'var(--foreground)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FROM BOX */}
        <div className="uniswap-input-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)' }}>
              {language === 'ko' ? '판매할 토큰' : 'You pay'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-foreground)' }}>
              <span>{t.balance}: <strong style={{ color: 'var(--foreground)' }}>{fromBalance}</strong></span>
              {parseFloat(fromBalance) > 0 && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setFromAmount((parseFloat(fromBalance) * 0.5).toFixed(4))}
                    style={{
                      background: 'var(--secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '2px 6px',
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'var(--primary)',
                      cursor: 'pointer',
                    }}
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setFromAmount(fromBalance)}
                    style={{
                      background: 'var(--secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '2px 6px',
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'var(--primary)',
                      cursor: 'pointer',
                    }}
                  >
                    MAX
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              placeholder="0"
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                fontSize: 32,
                fontWeight: 800,
                color: 'var(--foreground)',
                outline: 'none',
              }}
            />

            <button
              onClick={() => setShowFromModal(true)}
              className="uniswap-token-chip"
              style={{ flexShrink: 0 }}
            >
              <TokenIcon symbol={fromToken.symbol} size={22} />
              <span>{fromToken.symbol}</span>
              <ChevronDown size={14} style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </div>

          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>
            ~${(parseFloat(fromAmount || '0') * (fromToken.symbol === 'ETH' || fromToken.symbol === 'WETH' ? 2500 : 1)).toFixed(2)} USD
          </div>
        </div>

        {/* SWAP DIRECTION ARROW */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '-14px 0', position: 'relative', zIndex: 2 }}>
          <button
            onClick={handleSwapTokens}
            title="Switch tokens"
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'var(--card-solid, #131823)',
              border: '2px solid var(--border)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1) rotate(180deg)';
              e.currentTarget.style.borderColor = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <ArrowDownUp size={16} />
          </button>
        </div>

        {/* TO BOX */}
        <div className="uniswap-input-box" style={{ marginTop: 6, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-foreground)' }}>
              {language === 'ko' ? '받을 토큰 (예상)' : 'You receive'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              {t.balance}: <strong style={{ color: 'var(--foreground)' }}>{toBalance}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <input
              type="text"
              readOnly
              value={toAmount}
              placeholder="0"
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                fontSize: 32,
                fontWeight: 800,
                color: 'var(--foreground)',
                outline: 'none',
              }}
            />

            <button
              onClick={() => setShowToModal(true)}
              className="uniswap-token-chip"
              style={{ flexShrink: 0 }}
            >
              <TokenIcon symbol={toToken.symbol} size={22} />
              <span>{toToken.symbol}</span>
              <ChevronDown size={14} style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </div>

          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>
            ~${(parseFloat(toAmount || '0') * (toToken.symbol === 'ETH' || toToken.symbol === 'WETH' ? 2500 : 1)).toFixed(2)} USD
          </div>
        </div>

        {/* Route & Fee Breakdown Details */}
        {mode === 'MARKET' && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              background: 'var(--input)',
              border: '1px solid var(--border)',
              marginBottom: 16,
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)' }}>
              <span>{language === 'ko' ? '스마트 오더 라우트 (SOR)' : 'Smart Order Route'}</span>
              <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{smartRoute.routeLabel}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)' }}>
              <span>{language === 'ko' ? '네트워크 가스비' : 'Network Fee'}</span>
              <span style={{ fontWeight: 700, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Zap size={11} /> &lt; $0.001 (0.2s Flashblocks)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)' }}>
              <span>{language === 'ko' ? '최소 수령 수량' : 'Minimum Output'}</span>
              <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                {minimumOutputDisplay} {toToken.symbol}
              </span>
            </div>
          </div>
        )}

        {/* Limit Order Parameters */}
        {mode === 'LIMIT' && (
          <div style={{ padding: 14, borderRadius: 14, background: 'var(--input)', border: '1px solid var(--border)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 6 }}>
                <span>{language === 'ko' ? '목표 가격 (USD)' : 'Target Execution Price (USD)'}</span>
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>200ms Flashblocks Trigger</span>
              </div>
              <input
                type="number"
                value={limitTargetPrice}
                onChange={(e) => setLimitTargetPrice(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', background: 'none', border: 'none', fontSize: 20, fontWeight: 800, color: 'var(--foreground)', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 7, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setLimitDurationDays(days)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 8,
                    border: limitDurationDays === days ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: limitDurationDays === days ? 'var(--accent)' : 'var(--secondary)',
                    color: limitDurationDays === days ? 'var(--primary)' : 'var(--foreground)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {days} {days === 1 ? 'Day' : 'Days'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DCA Interval Settings */}
        {mode === 'DCA' && (
          <div style={{ padding: 14, borderRadius: 14, background: 'var(--input)', border: '1px solid var(--border)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['HOURLY', 'DAILY', 'WEEKLY'] as const).map((freq) => (
                <button
                  key={freq}
                  onClick={() => setDcaFrequency(freq)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 8,
                    border: dcaFrequency === freq ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: dcaFrequency === freq ? 'var(--accent)' : 'var(--secondary)',
                    color: dcaFrequency === freq ? 'var(--primary)' : 'var(--foreground)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {freq}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        {!address ? (
          <button onClick={onConnect} className="uniswap-btn-primary">
            {t.connectWallet || 'Connect Wallet'}
          </button>
        ) : isInputZero ? (
          <button disabled className="uniswap-btn-primary">
            {language === 'ko' ? '수량을 입력하세요' : 'Enter an amount'}
          </button>
        ) : isInsufficientBalance ? (
          <button disabled className="uniswap-btn-primary">
            {language === 'ko' ? `${fromToken.symbol} 잔액 부족` : `Insufficient ${fromToken.symbol} balance`}
          </button>
        ) : (
          <button
            onClick={
              mode === 'MARKET' ? executeMarketSwap :
              mode === 'LIMIT' ? handleCreateLimitOrder :
              handleCreateDCA
            }
            disabled={isSwapping}
            className="uniswap-btn-primary"
          >
            {isSwapping
              ? (language === 'ko' ? '스왑 처리 중...' : 'Swapping...')
              : mode === 'MARKET'
              ? (language === 'ko' ? `${fromToken.symbol} ➔ ${toToken.symbol} 스왑` : `Swap ${fromToken.symbol} to ${toToken.symbol}`)
              : mode === 'LIMIT'
              ? (language === 'ko' ? '지정가 주문 제출' : 'Place Limit Order')
              : (language === 'ko' ? 'DCA 스트림 시작' : 'Start DCA Stream')}
          </button>
        )}

        {/* Faucet Claim Pill */}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={handleClaimFaucet}
            disabled={isClaimingFaucet}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Droplets size={14} />
            <span>
              {isClaimingFaucet
                ? (language === 'ko' ? '토큰 지급 중...' : 'Claiming test tokens...')
                : (language === 'ko' ? '무료 테스트넷 1,000 토큰 받기 (Faucet)' : 'Claim 1,000 free testnet tokens (Faucet)')}
            </span>
          </button>
        </div>

        {/* Tx Receipt Confirmation */}
        {txHash && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#22c55e', fontWeight: 700 }}>
              <CheckCircle2 size={15} />
              <span>{language === 'ko' ? '스왑 체결 완료 (200ms)' : 'Swap Confirmed (200ms Flashblocks)'}</span>
            </div>
            <a
              href={`https://sepolia-explorer.giwa.io/tx/${txHash}`}
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
              {language === 'ko' ? '익스플로러' : 'Explorer'} <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>

      {/* Token Selection Modal */}
      {(showFromModal || showToModal) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => {
            setShowFromModal(false);
            setShowToModal(false);
          }}
        >
          <div
            className="uniswap-card"
            style={{ width: '100%', maxWidth: 420, padding: 20, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)' }}>
                {language === 'ko' ? '토큰 선택' : 'Select a token'}
              </h3>
              <button
                onClick={() => {
                  setShowFromModal(false);
                  setShowToModal(false);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Box */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 14,
                background: 'var(--input)',
                border: '1px solid var(--border)',
                marginBottom: 14,
              }}
            >
              <Search size={16} color="var(--muted-foreground)" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'ko' ? '토큰 이름 또는 심볼 검색' : 'Search name or symbol'}
                style={{ width: '100%', background: 'none', border: 'none', color: 'var(--foreground)', outline: 'none', fontSize: 14 }}
              />
            </div>

            {/* Quick Common Tokens Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {DEFAULT_TOKENS.slice(0, 4).map((t) => (
                <button
                  key={t.symbol}
                  onClick={() => {
                    if (showFromModal) setFromToken(t);
                    else setToToken(t);
                    setShowFromModal(false);
                    setShowToModal(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 9999,
                    background: 'var(--secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <TokenIcon symbol={t.symbol} size={18} />
                  <span>{t.symbol}</span>
                </button>
              ))}
            </div>

            {/* Token List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredTokens.map((t) => (
                <div
                  key={t.symbol}
                  onClick={() => {
                    if (showFromModal) setFromToken(t);
                    else setToToken(t);
                    setShowFromModal(false);
                    setShowToModal(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <TokenIcon symbol={t.symbol} size={32} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>{t.symbol}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{t.name}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
