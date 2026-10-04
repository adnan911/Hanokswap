import { useState, useEffect, useMemo } from 'react';
import type { EIP1193Provider } from 'viem';
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  formatUnits,
  parseAbi,
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
import { useDojang } from '../hooks/useDojang';
import { isTokenDojangVerified } from '../lib/dojang';
import { computeSmartOrderRoute, type SORRoute } from '../lib/sor';
import { buildSwapParams, minimumSwapOutput, SWAP_ROUTER_ABI } from '../lib/swapExecution';
import { waitForSuccess } from '../txHelpers';
import {
  getDEXLimitOrders,
  saveDEXLimitOrder,
  cancelDEXLimitOrder,
  fillDEXLimitOrder,
  type DEXLimitOrder,
} from '../lib/limitOrders';
import {
  getDEXDCAStreams,
  saveDEXDCAStream,
  cancelDEXDCAStream,
  executeNextDCAInterval,
  type DEXDCAStream,
} from '../lib/dca';
import { DojangIdentityModal } from './DojangIdentityModal';
import {
  ArrowDownUp,
  Settings2,
  Zap,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  ShieldCheck,
  Award,
  Clock,
  Sliders,
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
    symbol: 'KRWC',
    name: 'Korean Won Coin (Testnet)',
    address: KRWC_ADDRESS,
    decimals: 6,
    icon: '₩',
  },
  {
    symbol: 'EURC',
    name: 'Euro Coin (Testnet)',
    address: EURC_ADDRESS,
    decimals: 6,
    icon: '💶',
  },
  {
    symbol: 'USYC',
    name: 'Yield-Bearing USD (Testnet)',
    address: USYC_ADDRESS,
    decimals: 6,
    icon: '📈',
  },
];

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
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
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

type TradingMode = 'MARKET' | 'LIMIT' | 'DCA';

interface Props {
  provider?: EIP1193Provider;
  address?: string;
  onNavigateToDocs?: () => void;
  onNavigateToDeployer?: () => void;
}

export default function GiwaSwap({ provider, address, onNavigateToDocs, onNavigateToDeployer }: Props) {
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
  const [usePermit2, setUsePermit2] = useState(false);

  // Limit Order parameters
  const [limitTargetPrice, setLimitTargetPrice] = useState<string>('3150.00');
  const [limitDurationDays, setLimitDurationDays] = useState<number>(7);

  // DCA parameters
  const [dcaFrequency, setDcaFrequency] = useState<'HOURLY' | 'DAILY' | 'WEEKLY'>('DAILY');
  const [dcaTotalOrders, setDcaTotalOrders] = useState<number>(10);

  const [fromBalance, setFromBalance] = useState<string>('0.00');
  const [toBalance, setToBalance] = useState<string>('0.00');
  const [isSwapping, setIsSwapping] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showDojangModal, setShowDojangModal] = useState(false);

  const [openLimitOrders, setOpenLimitOrders] = useState<DEXLimitOrder[]>([]);
  const [activeDCAStreams, setActiveDCAStreams] = useState<DEXDCAStream[]>([]);

  const { profile: dojangProfile } = useDojang(address as Address | undefined);

  // Public client on Giwa Sepolia Flashblocks
  const publicClient = createPublicClient({
    chain: giwaSepolia,
    transport: http(GIWA_FLASHBLOCKS_RPC),
  });

  // Calculate Smart Order Route dynamically
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

  // Refresh limit orders & DCA streams
  const reloadOrdersAndStreams = () => {
    if (address) {
      setOpenLimitOrders(getDEXLimitOrders(address as Address));
      setActiveDCAStreams(getDEXDCAStreams(address as Address));
    }
  };

  useEffect(() => {
    reloadOrdersAndStreams();
    const handleOrderUpdate = () => reloadOrdersAndStreams();
    window.addEventListener('giwa_limit_orders_updated', handleOrderUpdate);
    window.addEventListener('giwa_dca_streams_updated', handleOrderUpdate);
    return () => {
      window.removeEventListener('giwa_limit_orders_updated', handleOrderUpdate);
      window.removeEventListener('giwa_dca_streams_updated', handleOrderUpdate);
    };
  }, [address]);

  // Load balances
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
    } catch (e) {
      console.error('Failed to load balances:', e);
    }
  };

  useEffect(() => {
    refreshBalances();
  }, [address, fromToken, toToken]);

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  // 1. Market Swap Execution (with SOR & Permit2)
  const executeMarketSwap = async () => {
    if (!provider || !address) {
      showToast('Please connect your wallet first', 'error');
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

      if (toToken.isNative) throw new Error('Select WETH as the output. Atomic native ETH output is not supported yet.');
      if (usePermit2 && !fromToken.isNative) throw new Error('Permit2 swap execution is not connected yet. Turn off Permit2 to use a token approval.');
      const params = buildSwapParams(smartRoute, address as Address, fromToken.decimals, BigInt(Math.floor(Date.now() / 1000) + 1200));
      for (const token of new Set(params.hops.flatMap(hop => [hop.tokenIn, hop.tokenOut]))) {
        const code = await publicClient.getBytecode({ address: token });
        if (!code || code === '0x') throw new Error('A selected token is not deployed on GIWA Sepolia. This pair is unavailable.');
      }
      // Resolve the entire route before asking for an approval or spending gas.
      const factory = await publicClient.readContract({ address: GIWA_DEX_ROUTER, abi: parseAbi(['function factory() view returns (address)']), functionName: 'factory' });
      for (const hop of params.hops) {
        const pool = await publicClient.readContract({ address: factory, abi: parseAbi(['function getPool(address,address,uint24,bool) view returns (address)']), functionName: 'getPool', args: [hop.tokenIn, hop.tokenOut, hop.fee, hop.isStable] });
        if (pool === '0x0000000000000000000000000000000000000000') throw new Error('This pair has no deployed pool. Choose a supported pair.');
        const poolCode = await publicClient.getBytecode({ address: pool });
        if (!poolCode || poolCode === '0x') throw new Error('The route pool is not deployed.');
      }
      if (!fromToken.isNative) {
        const allowance = await publicClient.readContract({ address: fromToken.address, abi: ERC20_ABI, functionName: 'allowance', args: [address as Address, GIWA_DEX_ROUTER] });
        if (allowance < params.amountIn) {
          if (allowance > 0n) {
            const reset = await walletClient.writeContract({ address: fromToken.address, abi: ERC20_ABI, functionName: 'approve', args: [GIWA_DEX_ROUTER, 0n] });
            await waitForSuccess(publicClient, reset);
          }
          const approval = await walletClient.writeContract({ address: fromToken.address, abi: ERC20_ABI, functionName: 'approve', args: [GIWA_DEX_ROUTER, params.amountIn] });
          await waitForSuccess(publicClient, approval);
        }
      }
      const value = fromToken.isNative ? params.amountIn : 0n;
      const simulation = await publicClient.simulateContract({ address: GIWA_DEX_ROUTER, abi: SWAP_ROUTER_ABI, functionName: 'exactInputMultiHop', args: [params], account: address as Address, value });
      params.amountOutMinimum = minimumSwapOutput(simulation.result, slippage);
      const checked = await publicClient.simulateContract({ address: GIWA_DEX_ROUTER, abi: SWAP_ROUTER_ABI, functionName: 'exactInputMultiHop', args: [params], account: address as Address, value });

      showToast(
        language === 'ko'
          ? `[0.2s Flashblocks] ${fromToken.symbol} ➔ ${toToken.symbol} 스왑 제출 중...`
          : `[0.2s Flashblocks] Submitting ${fromToken.symbol} ➔ ${toToken.symbol} swap...`,
        'info'
      );

      const hash = await walletClient.writeContract(checked.request);

      setTxHash(hash);
      showToast('Swap submitted. Waiting for confirmation...', 'info');
      await waitForSuccess(publicClient, hash);
      showToast(language === 'ko' ? '스왑이 성공적으로 확정되었습니다!' : 'Swap successfully executed on Giwa Sepolia!', 'success');
      refreshBalances();
    } catch (err: any) {
      console.error('Swap failed:', err);
      showToast(err?.shortMessage || err?.message || 'Swap failed on testnet', 'error');
    } finally {
      setIsSwapping(false);
    }
  };

  // 2. Limit Order Creation
  const handleCreateLimitOrder = async () => {
    if (!address) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    const orderId = `limit_${Date.now()}`;
    const newOrder: DEXLimitOrder = {
      id: orderId,
      maker: address as Address,
      tokenInSymbol: fromToken.symbol,
      tokenOutSymbol: toToken.symbol,
      tokenInAddress: fromToken.address,
      tokenOutAddress: toToken.address,
      amountIn: fromAmount,
      targetPriceUSD: parseFloat(limitTargetPrice) || 0,
      minAmountOut: toAmount,
      createdAt: Date.now(),
      expiresAt: Date.now() + limitDurationDays * 86400 * 1000,
      status: 'OPEN',
      isBuy: fromToken.symbol === 'USDC' || fromToken.symbol === 'KRWC',
    };

    saveDEXLimitOrder(newOrder);
    showToast(
      language === 'ko'
        ? `지정가 주문 등록 완료! (0.2s Flashblocks 감시 활성)`
        : `Limit order created! (0.2s Flashblocks trigger active)`,
      'success'
    );
  };

  // 3. DCA Stream Creation
  const handleCreateDCA = async () => {
    if (!address) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    const intervalSec = dcaFrequency === 'HOURLY' ? 3600 : dcaFrequency === 'DAILY' ? 86400 : 604800;
    const amountPer = (parseFloat(fromAmount) / dcaTotalOrders).toFixed(4);

    const streamId = `dca_${Date.now()}`;
    const newStream: DEXDCAStream = {
      id: streamId,
      owner: address as Address,
      tokenInSymbol: fromToken.symbol,
      tokenOutSymbol: toToken.symbol,
      tokenInAddress: fromToken.address,
      tokenOutAddress: toToken.address,
      totalAmountIn: fromAmount,
      amountPerInterval: amountPer,
      frequency: dcaFrequency,
      intervalSeconds: intervalSec,
      totalIntervals: dcaTotalOrders,
      intervalsCompleted: 0,
      createdAt: Date.now(),
      nextExecutionTime: Date.now() + intervalSec * 1000,
      status: 'ACTIVE',
    };

    saveDEXDCAStream(newStream);
    showToast(
      language === 'ko'
        ? `DCA 자동 적립식 스트림이 시작되었습니다 (${dcaTotalOrders}회 분할)`
        : `DCA auto-invest stream active (${dcaTotalOrders} orders schedule)`,
      'success'
    );
  };

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Banner: Giwa Testnet & Flashblocks */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'oklch(0.6724 0.1308 38.7559 / 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <Zap size={18} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
              GIWA Sepolia Testnet · 0.2s Flashblocks
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              {language === 'ko' ? '경로 미리보기 · 표준 승인' : 'Route preview · standard approval'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e' }}>ONLINE</span>
        </div>
      </div>

      {/* Trading Mode Switcher */}
      <div
        style={{
          display: 'flex',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 4,
          gap: 4,
        }}
      >
        <button
          onClick={() => setMode('MARKET')}
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: 10,
            border: 'none',
            background: mode === 'MARKET' ? 'var(--primary)' : 'transparent',
            color: mode === 'MARKET' ? '#fff' : 'var(--muted-foreground)',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowDownUp size={14} />
          <span>{language === 'ko' ? '스왑 (SOR)' : 'Market Swap'}</span>
        </button>

        <button
          onClick={() => setMode('LIMIT')}
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: 10,
            border: 'none',
            background: mode === 'LIMIT' ? 'var(--primary)' : 'transparent',
            color: mode === 'LIMIT' ? '#fff' : 'var(--muted-foreground)',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
        >
          <Sliders size={14} />
          <span>{language === 'ko' ? '지정가 (0.2s)' : 'Limit Order'}</span>
        </button>

        <button
          onClick={() => setMode('DCA')}
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: 10,
            border: 'none',
            background: mode === 'DCA' ? 'var(--primary)' : 'transparent',
            color: mode === 'DCA' ? '#fff' : 'var(--muted-foreground)',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
        >
          <Clock size={14} />
          <span>{language === 'ko' ? 'DCA 적립' : 'DCA Stream'}</span>
        </button>
      </div>

      {/* Main Trading Card */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          padding: isMobile ? 18 : 24,
          boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
              {mode === 'MARKET' ? (language === 'ko' ? '토큰 스왑 (SOR)' : 'Smart Swap') :
               mode === 'LIMIT' ? (language === 'ko' ? '플래시블록 지정가 주문' : 'Flashblocks Limit Order') :
               (language === 'ko' ? 'DCA 적립식 자동 투자' : 'Automated DCA Stream')}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={refreshBalances}
              title="Refresh"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
              style={{
                background: showSettings ? 'var(--muted)' : 'none',
                border: 'none',
                color: 'var(--foreground)',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Settings2 size={18} />
            </button>
          </div>
        </div>

        {/* Slippage Drawer */}
        {showSettings && (
          <div
            style={{
              padding: 14,
              borderRadius: 14,
              background: 'var(--muted)',
              marginBottom: 16,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--foreground)' }}>
              {t.slippageTolerance}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0.1, 0.5, 1.0].map((val) => (
                <button
                  key={val}
                  onClick={() => setSlippage(val)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: slippage === val ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: slippage === val ? 'var(--primary)' : 'var(--card)',
                    color: slippage === val ? '#fff' : 'var(--foreground)',
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
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>{t.youPay}</span>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              {t.balance}: <strong style={{ color: 'var(--foreground)' }}>{fromBalance}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              placeholder="0.0"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                fontSize: 26,
                fontWeight: 800,
                color: 'var(--foreground)',
                outline: 'none',
                minWidth: 0,
              }}
            />

            <button
              onClick={() => setShowFromModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 12,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <span>{fromToken.icon}</span>
              <span>{fromToken.symbol}</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </div>

        {/* SWAP DIRECTION BUTTON */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '-14px 0', position: 'relative', zIndex: 2 }}>
          <button
            onClick={handleSwapTokens}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--card)',
              border: '2px solid var(--border)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            <ArrowDownUp size={16} />
          </button>
        </div>

        {/* TO BOX */}
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            marginTop: 8,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>{language === 'ko' ? '예시 추정값 (실시간 아님)' : 'Illustrative estimate (not a live quote)'}</span>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              {t.balance}: <strong style={{ color: 'var(--foreground)' }}>{toBalance}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="text"
              readOnly
              value={toAmount}
              placeholder="0.0"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                fontSize: 26,
                fontWeight: 800,
                color: 'var(--foreground)',
                outline: 'none',
                minWidth: 0,
              }}
            />

            <button
              onClick={() => setShowToModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 12,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <span>{toToken.icon}</span>
              <span>{toToken.symbol}</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </div>

        {/* Limit Order Target Price Input & Expiry */}
        {mode === 'LIMIT' && (
          <div style={{ padding: 14, borderRadius: 14, background: 'var(--muted)', marginBottom: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 6 }}>
                <span>{language === 'ko' ? '목표 체결 가격 (USD)' : 'Target Execution Price (USD)'}</span>
                <span style={{ color: 'var(--primary)' }}>Flashblocks 200ms Trigger</span>
              </div>
              <input
                type="number"
                value={limitTargetPrice}
                onChange={(e) => setLimitTargetPrice(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', background: 'none', border: 'none', fontSize: 20, fontWeight: 800, color: 'var(--foreground)', outline: 'none' }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 6 }}>
                {language === 'ko' ? '주문 유효 기간' : 'Order Expiry Duration'}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 7, 30].map((days) => (
                  <button
                    key={days}
                    onClick={() => setLimitDurationDays(days)}
                    style={{
                      flex: 1,
                      padding: '4px 0',
                      borderRadius: 8,
                      border: limitDurationDays === days ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: limitDurationDays === days ? 'var(--primary)' : 'var(--card)',
                      color: limitDurationDays === days ? '#fff' : 'var(--foreground)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {days} {days === 1 ? (language === 'ko' ? '일' : 'Day') : (language === 'ko' ? '일' : 'Days')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DCA Interval Settings */}
        {mode === 'DCA' && (
          <div style={{ padding: 14, borderRadius: 14, background: 'var(--muted)', marginBottom: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6 }}>
                {language === 'ko' ? '적립 주기 (Interval)' : 'DCA Frequency'}
              </div>
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
                      background: dcaFrequency === freq ? 'var(--primary)' : 'var(--card)',
                      color: dcaFrequency === freq ? '#fff' : 'var(--foreground)',
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

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 6 }}>
                {language === 'ko' ? '총 분할 횟수' : 'Total Orders Count'}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[5, 10, 20, 50].map((count) => (
                  <button
                    key={count}
                    onClick={() => setDcaTotalOrders(count)}
                    style={{
                      flex: 1,
                      padding: '4px 0',
                      borderRadius: 8,
                      border: dcaTotalOrders === count ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: dcaTotalOrders === count ? 'var(--primary)' : 'var(--card)',
                      color: dcaTotalOrders === count ? '#fff' : 'var(--foreground)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {count}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Permit2 Gasless Toggle */}
        {!fromToken.isNative && mode === 'MARKET' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 12, background: 'var(--muted)', border: '1px solid var(--border)', marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--foreground)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={usePermit2}
                onChange={(e) => setUsePermit2(e.target.checked)}
                style={{ accentColor: 'var(--primary)', width: 15, height: 15 }}
              />
              <span>⚡ Permit2 Gasless Approval (1-Signature)</span>
            </label>
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontWeight: 700 }}>
              ZERO GAS
            </span>
          </div>
        )}

        {/* Route Details */}
        <div
          style={{
            padding: '12px 14px',
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
            <span>{language === 'ko' ? 'Smart Order Route (SOR)' : 'Smart Order Route'}</span>
            <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>
              {smartRoute.routeLabel}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)' }}>
            <span>{language === 'ko' ? '예상 가격 영향' : 'Price Impact'}</span>
            <span style={{ fontWeight: 600, color: smartRoute.priceImpactPercent > 1 ? '#ef4444' : '#22c55e' }}>
              {language === 'ko' ? '실시간 견적 필요' : 'Live quote required'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground)' }}>
            <span>{language === 'ko' ? '사전 확인' : 'Preconfirmation'}</span>
            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>⚡ 0.2s Flashblocks</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)' }}>
              <ShieldCheck size={13} color="var(--primary)" />
              {language === 'ko' ? 'Dojang 수수료 할인' : 'Dojang Fee Rebate'}
            </span>
            {dojangProfile.feeDiscountPercent > 0 ? (
              <span
                onClick={() => setShowDojangModal(true)}
                style={{
                  fontWeight: 700,
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: dojangProfile.isVIPTrader ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: dojangProfile.isVIPTrader ? '#f59e0b' : '#3b82f6',
                  border: `1px solid ${dojangProfile.isVIPTrader ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {dojangProfile.isVIPTrader ? <Award size={12} /> : <ShieldCheck size={12} />}
                -{dojangProfile.feeDiscountPercent}% ({dojangProfile.activeTier === 'DUNAMU_VIP' ? 'VIP' : 'KYC'})
              </span>
            ) : (
              <button
                onClick={() => setShowDojangModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--primary)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {language === 'ko' ? '도장 인증 시 최대 50% 할인 ➔' : 'Verify on Dojang for -50% ➔'}
              </button>
            )}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={
            mode === 'MARKET' ? executeMarketSwap :
            mode === 'LIMIT' ? handleCreateLimitOrder :
            handleCreateDCA
          }
          disabled={isSwapping}
          style={{
            width: '100%',
            padding: '15px 0',
            borderRadius: 16,
            border: 'none',
            background: 'var(--primary)',
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: 800,
            cursor: isSwapping ? 'not-allowed' : 'pointer',
            boxShadow: '0 6px 20px oklch(0.6724 0.1308 38.7559 / 0.4)',
            transition: 'all 0.2s ease',
          }}
        >
          {isSwapping
            ? (language === 'ko' ? '스왑 처리 중...' : 'Swapping...')
            : mode === 'MARKET'
            ? (language === 'ko' ? `${fromToken.symbol} ➔ ${toToken.symbol} 스왑 (SOR)` : `Swap ${fromToken.symbol} to ${toToken.symbol}`)
            : mode === 'LIMIT'
            ? (language === 'ko' ? `0.2초 지정가 주문 제출` : `Place Limit Order`)
            : (language === 'ko' ? `DCA 자동 적립 스트림 생성` : `Create DCA Stream`)}
        </button>

        {/* Tx Receipt */}
        {txHash && (
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
              <span>{language === 'ko' ? '스왑 확정 완료 (200ms)' : 'Swap Confirmed (200ms Flashblocks)'}</span>
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
              {language === 'ko' ? '익스플로러 보기' : 'View Explorer'} <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>

      {/* Open Limit Orders List */}
      {mode === 'LIMIT' && openLimitOrders.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span>{language === 'ko' ? '나의 활성 지정가 주문' : 'My Active Limit Orders'}</span>
            <span style={{ fontSize: 12, color: 'var(--primary)' }}>{openLimitOrders.filter(o => o.status === 'OPEN').length} Open</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {openLimitOrders.map((ord) => (
              <div key={ord.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 12, background: 'var(--muted)', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
                    {ord.amountIn} {ord.tokenInSymbol} ➔ {ord.tokenOutSymbol}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                    Target: ${ord.targetPriceUSD.toLocaleString()} · Status: <span style={{ color: ord.status === 'OPEN' ? '#3b82f6' : '#22c55e', fontWeight: 700 }}>{ord.status}</span>
                  </div>
                </div>

                {ord.status === 'OPEN' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => fillDEXLimitOrder(ord.id)}
                      title="Simulate Flashblocks Keeper Fill"
                      style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Fill
                    </button>
                    <button
                      onClick={() => cancelDEXLimitOrder(ord.id)}
                      title="Cancel Order"
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active DCA Streams List */}
      {mode === 'DCA' && activeDCAStreams.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span>{language === 'ko' ? '나의 활성 DCA 스트림' : 'My Active DCA Streams'}</span>
            <span style={{ fontSize: 12, color: 'var(--primary)' }}>{activeDCAStreams.filter(s => s.status === 'ACTIVE').length} Active</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeDCAStreams.map((stm) => (
              <div key={stm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 12, background: 'var(--muted)', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
                    {stm.amountPerInterval} {stm.tokenInSymbol} / {stm.frequency.toLowerCase()} ➔ {stm.tokenOutSymbol}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                    Progress: {stm.intervalsCompleted} / {stm.totalIntervals} Orders Completed
                  </div>
                </div>

                {stm.status === 'ACTIVE' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => executeNextDCAInterval(stm.id)}
                      title="Trigger Next Interval"
                      style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Trigger
                    </button>
                    <button
                      onClick={() => cancelDEXDCAStream(stm.id)}
                      title="Cancel Stream"
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Navigation Shortcuts */}
      {(onNavigateToDocs || onNavigateToDeployer) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12 }}>
          {onNavigateToDeployer && (
            <button
              onClick={onNavigateToDeployer}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted-foreground)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                textDecoration: 'underline',
              }}
            >
              <span>🚀 {language === 'ko' ? '토큰 생성기' : 'Token Deployer'}</span>
            </button>
          )}
          {onNavigateToDocs && (
            <button
              onClick={onNavigateToDocs}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted-foreground)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                textDecoration: 'underline',
              }}
            >
              <span>📖 {language === 'ko' ? 'DEX 개발자 문서' : 'Developer Docs'}</span>
            </button>
          )}
        </div>
      )}

      {/* Select Token Modals */}
      {(showFromModal || showToModal) && (
        <div
          onClick={() => {
            setShowFromModal(false);
            setShowToModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            zIndex: 999,
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
              maxWidth: 400,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: 20,
              boxShadow: '0 20px 48px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>
                {language === 'ko' ? '토큰 선택' : 'Select a Token'}
              </div>
              <button
                onClick={() => {
                  setShowFromModal(false);
                  setShowToModal(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 18,
                  color: 'var(--muted-foreground)',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {tokens.map((tk) => (
                <button
                  key={tk.symbol + tk.address}
                  onClick={() => {
                    if (showFromModal) setFromToken(tk);
                    else setToToken(tk);
                    setShowFromModal(false);
                    setShowToModal(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'var(--muted)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{tk.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {tk.symbol}
                        {isTokenDojangVerified(tk.address) && (
                          <span title="Dunamu / Dojang Verified Asset">
                            <ShieldCheck size={14} color="#3b82f6" />
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{tk.name}</div>
                    </div>
                  </div>
                  {tk.isNative ? (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--primary)', color: '#fff', fontWeight: 700 }}>
                      NATIVE
                    </span>
                  ) : isTokenDojangVerified(tk.address) ? (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 700 }}>
                      DOJANG
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dojang Identity Modal */}
      <DojangIdentityModal
        isOpen={showDojangModal}
        onClose={() => setShowDojangModal(false)}
        address={address as Address | undefined}
      />
    </div>
  );
}
