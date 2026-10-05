import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { useCurrency } from "../CurrencyContext";
import { Zap, TrendingUp, BarChart2, RefreshCw } from "lucide-react";

export type ChartSymbol = "ETH" | "BTC" | "KRWC" | "EURC";

interface Props {
  symbol?: ChartSymbol;
  onSymbolChange?: (s: ChartSymbol) => void;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface VolumePoint {
  time: number;
  value: number;
  color: string;
}

interface LinePoint {
  time: number;
  value: number;
}

const TIMEFRAMES = [
  { label: "1m", interval: "1m", seconds: 60, binanceInterval: "1m", upbitUnit: 1 },
  { label: "5m", interval: "5m", seconds: 300, binanceInterval: "5m", upbitUnit: 5 },
  { label: "15m", interval: "15m", seconds: 900, binanceInterval: "15m", upbitUnit: 15 },
  { label: "1H", interval: "1h", seconds: 3600, binanceInterval: "1h", upbitUnit: 60 },
  { label: "1D", interval: "1d", seconds: 86400, binanceInterval: "1d", upbitUnit: "days" },
] as const;

type TimeframeLabel = (typeof TIMEFRAMES)[number]["label"];

const BINANCE_SYMBOLS: Record<ChartSymbol, string> = {
  ETH: "ETHUSDT",
  BTC: "BTCUSDT",
  KRWC: "USDCUSDT",
  EURC: "EURUSDT",
};

export default function TradingViewChart({ symbol = "ETH", onSymbolChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const { currency, formatCurrencyValue, rates } = useCurrency();
  const [timeframe, setTimeframe] = useState<TimeframeLabel>("1m");
  const [showMA, setShowMA] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [activeSymbol, setActiveSymbol] = useState<ChartSymbol>(symbol);
  const [lastPrice, setLastPrice] = useState<number>(3150.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActiveSymbol(symbol);
  }, [symbol]);

  // Currency Multiplier
  const fxMultiplier = currency === "KRW" ? (rates.usdKrw || 1400) : 1;

  // Initialize Chart Container
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 340,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "var(--muted-foreground)",
        fontFamily: "'Space Grotesk', 'JetBrains Mono', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "var(--border)" },
        horzLines: { color: "var(--border)" },
      },
      rightPriceScale: {
        borderColor: "var(--border)",
        scaleMargins: {
          top: 0.1,
          bottom: 0.25,
        },
      },
      timeScale: {
        borderColor: "var(--border)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: 0 },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const maSeries = chart.addSeries(LineSeries, {
      color: "var(--primary)",
      lineWidth: 2,
      priceLineVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    maSeriesRef.current = maSeries;

    function handleResize() {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      maSeriesRef.current = null;
    };
  }, []);

  // Fetch REAL Live Candlestick & Volume Data
  const fetchRealCandles = useCallback(async () => {
    setLoading(true);
    setError(null);
    const tf = TIMEFRAMES.find((t) => t.label === timeframe) || TIMEFRAMES[0];
    const binanceSymbol = BINANCE_SYMBOLS[activeSymbol] || "ETHUSDT";

    try {
      // 1. Fetch real Kline data from public Binance endpoint
      const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${tf.binanceInterval}&limit=100`;
      const res = await fetch(binanceUrl);
      
      if (!res.ok) {
        throw new Error(`Binance API returned ${res.status}`);
      }

      const rawData = await res.json();
      if (!Array.isArray(rawData) || rawData.length === 0) {
        throw new Error("No candle data returned");
      }

      const candles: Candle[] = [];
      const volumes: VolumePoint[] = [];

      for (const item of rawData) {
        const time = Math.floor(Number(item[0]) / 1000); // Unix timestamp in seconds
        const open = parseFloat(item[1]) * fxMultiplier;
        const high = parseFloat(item[2]) * fxMultiplier;
        const low = parseFloat(item[3]) * fxMultiplier;
        const close = parseFloat(item[4]) * fxMultiplier;
        const vol = parseFloat(item[5]);

        candles.push({ time, open, high, low, close });

        const isUp = close >= open;
        volumes.push({
          time,
          value: vol,
          color: isUp ? "rgba(34, 197, 94, 0.45)" : "rgba(239, 68, 68, 0.45)",
        });
      }

      // Compute 20-period Moving Average
      const ma20: LinePoint[] = [];
      for (let i = 0; i < candles.length; i++) {
        if (i >= 19) {
          const slice = candles.slice(i - 19, i + 1);
          const avg = slice.reduce((sum, c) => sum + c.close, 0) / 20;
          ma20.push({ time: candles[i].time, value: avg });
        }
      }

      // Update Chart Series
      if (candleSeriesRef.current) {
        candleSeriesRef.current.setData(candles as any);
        const latest = candles[candles.length - 1];
        if (latest) {
          setLastPrice(latest.close / fxMultiplier);
        }
      }
      if (volumeSeriesRef.current && showVolume) {
        volumeSeriesRef.current.setData(volumes as any);
      }
      if (maSeriesRef.current && showMA) {
        maSeriesRef.current.setData(ma20 as any);
      }
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    } catch (err: any) {
      // Fallback to Upbit Proxy if Binance is rate-limited or blocked
      try {
        const upbitMarket = activeSymbol === "BTC" ? "KRW-BTC" : "KRW-ETH";
        const upbitUrl = `/api/upbit-proxy?path=${encodeURIComponent(`/candles/minutes/1?market=${upbitMarket}&count=60`)}`;
        const upbitRes = await fetch(upbitUrl);
        if (upbitRes.ok) {
          const upbitData = await upbitRes.json();
          if (Array.isArray(upbitData) && upbitData.length > 0) {
            const sorted = [...upbitData].reverse();
            const candles: Candle[] = [];
            const volumes: VolumePoint[] = [];

            for (const item of sorted) {
              const time = Math.floor(new Date(item.candle_date_time_utc + "Z").getTime() / 1000);
              const open = (item.opening_price / (rates.usdKrw || 1400)) * fxMultiplier;
              const high = (item.high_price / (rates.usdKrw || 1400)) * fxMultiplier;
              const low = (item.low_price / (rates.usdKrw || 1400)) * fxMultiplier;
              const close = (item.trade_price / (rates.usdKrw || 1400)) * fxMultiplier;
              const vol = item.candle_acc_trade_volume || 0;

              candles.push({ time, open, high, low, close });
              volumes.push({
                time,
                value: vol,
                color: close >= open ? "rgba(34, 197, 94, 0.45)" : "rgba(239, 68, 68, 0.45)",
              });
            }

            if (candleSeriesRef.current) {
              candleSeriesRef.current.setData(candles as any);
              const latest = candles[candles.length - 1];
              if (latest) setLastPrice(latest.close / fxMultiplier);
            }
            if (volumeSeriesRef.current && showVolume) {
              volumeSeriesRef.current.setData(volumes as any);
            }
            if (chartRef.current) {
              chartRef.current.timeScale().fitContent();
            }
            return;
          }
        }
      } catch {}
      setError("Unable to load real-time market data");
    } finally {
      setLoading(false);
    }
  }, [activeSymbol, timeframe, fxMultiplier, showMA, showVolume, rates.usdKrw]);

  useEffect(() => {
    fetchRealCandles();
    // Poll real market data every 10 seconds
    const interval = setInterval(fetchRealCandles, 10000);
    return () => clearInterval(interval);
  }, [fetchRealCandles]);

  const symbolsList: ChartSymbol[] = ["ETH", "BTC", "KRWC", "EURC"];

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden", boxShadow: "0 16px 40px rgba(0,0,0,0.25)" }}>
      {/* Chart Top Control Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
        {/* Symbol Switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {symbolsList.map((s) => (
            <button
              key={s}
              onClick={() => {
                setActiveSymbol(s);
                onSymbolChange?.(s);
              }}
              style={{
                padding: "5px 12px",
                borderRadius: 8,
                border: activeSymbol === s ? "1px solid var(--primary)" : "1px solid transparent",
                background: activeSymbol === s ? "var(--accent)" : "transparent",
                color: activeSymbol === s ? "var(--primary)" : "var(--muted-foreground)",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {s}/USD
            </button>
          ))}
        </div>

        {/* Live Flashblocks & Price Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Zap size={14} color="var(--primary)" />
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)" }}>Real-Time Live Feed</span>
          </div>
          <div className="prism-mono" style={{ fontSize: 15, fontWeight: 800, color: "var(--foreground)" }}>
            {formatCurrencyValue(lastPrice)}
          </div>
          <button
            onClick={fetchRealCandles}
            title="Refresh Real Market Data"
            style={{
              background: "var(--secondary)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "4px 8px",
              color: "var(--foreground)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Timeframes & Indicators Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "0.5rem 1rem", background: "var(--muted)" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.label}
              onClick={() => setTimeframe(tf.label)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
                background: timeframe === tf.label ? "var(--primary)" : "transparent",
                color: timeframe === tf.label ? "#FFFFFF" : "var(--muted-foreground)",
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setShowMA(!showMA)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: showMA ? "var(--accent)" : "transparent",
              color: showMA ? "var(--primary)" : "var(--muted-foreground)",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <TrendingUp size={12} />
            <span>MA (20)</span>
          </button>

          <button
            onClick={() => setShowVolume(!showVolume)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: showVolume ? "var(--accent)" : "transparent",
              color: showVolume ? "var(--primary)" : "var(--muted-foreground)",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <BarChart2 size={12} />
            <span>Volume</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div style={{ height: 340, padding: "0.5rem", position: "relative" }}>
        {error && (
          <div style={{ position: "absolute", top: 12, left: 12, color: "#ef4444", fontSize: 11, zIndex: 10 }}>
            {error}
          </div>
        )}
        <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      </div>
    </div>
  );
}
