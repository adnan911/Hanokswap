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
import { Zap, TrendingUp, BarChart2 } from "lucide-react";

export type ChartSymbol = "ETH" | "BTC" | "KRWC" | "HANOK" | "GIWA";

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
  { label: "1s", binanceInterval: "1s", limit: 60, seconds: 1 },
  { label: "5s", binanceInterval: "5s", limit: 60, seconds: 5 },
  { label: "1m", binanceInterval: "1m", limit: 120, seconds: 60 },
  { label: "5m", binanceInterval: "5m", limit: 120, seconds: 300 },
  { label: "15m", binanceInterval: "15m", limit: 120, seconds: 900 },
  { label: "1H", binanceInterval: "1h", limit: 168, seconds: 3600 },
  { label: "1D", binanceInterval: "1d", limit: 180, seconds: 86400 },
] as const;

type TimeframeLabel = (typeof TIMEFRAMES)[number]["label"];

function generateSyntheticCandles(basePrice: number, count: number, stepSec: number): { candles: Candle[]; volumes: VolumePoint[]; ma20: LinePoint[] } {
  const now = Math.floor(Date.now() / 1000);
  const candles: Candle[] = [];
  const volumes: VolumePoint[] = [];
  let currentPrice = basePrice;

  for (let i = count; i >= 0; i--) {
    const time = now - i * stepSec;
    const changePct = (Math.random() - 0.49) * 0.008;
    const open = currentPrice;
    const close = open * (1 + changePct);
    const high = Math.max(open, close) * (1 + Math.random() * 0.003);
    const low = Math.min(open, close) * (1 - Math.random() * 0.003);
    currentPrice = close;

    candles.push({ time, open, high, low, close });

    const isUp = close >= open;
    volumes.push({
      time,
      value: Math.floor(Math.random() * 80 + 20) * (basePrice > 100 ? 5 : 5000),
      color: isUp ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)",
    });
  }

  // Calculate 20-period Moving Average
  const ma20: LinePoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i >= 19) {
      const slice = candles.slice(i - 19, i + 1);
      const avg = slice.reduce((sum, c) => sum + c.close, 0) / 20;
      ma20.push({ time: candles[i].time, value: avg });
    }
  }

  return { candles, volumes, ma20 };
}

const BASE_PRICES_USD: Record<ChartSymbol, number> = {
  ETH: 3150.0,
  BTC: 66800.0,
  KRWC: 0.000714, // 1 KRW in USD
  HANOK: 0.082,
  GIWA: 2.45,
};

export default function TradingViewChart({ symbol = "ETH", onSymbolChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const { currency, formatCurrencyValue } = useCurrency();
  const [timeframe, setTimeframe] = useState<TimeframeLabel>("1m");
  const [showMA, setShowMA] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [activeSymbol, setActiveSymbol] = useState<ChartSymbol>(symbol);
  const [lastPrice, setLastPrice] = useState<number>(BASE_PRICES_USD[symbol]);

  useEffect(() => {
    setActiveSymbol(symbol);
  }, [symbol]);

  // Currency Multiplier
  const fxMultiplier = currency === "KRW" ? 1400 : currency === "ETH" ? 1 / BASE_PRICES_USD.ETH : 1;

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
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
        secondsVisible: timeframe === "1s" || timeframe === "5s",
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
  }, [timeframe]);

  // Load candles data
  const loadChartData = useCallback(() => {
    const tf = TIMEFRAMES.find((t) => t.label === timeframe) || TIMEFRAMES[2];
    const basePrice = (BASE_PRICES_USD[activeSymbol] || 100) * fxMultiplier;
    const { candles, volumes, ma20 } = generateSyntheticCandles(basePrice, tf.limit, tf.seconds);

    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData(candles as any);
      const latest = candles[candles.length - 1];
      if (latest) setLastPrice(latest.close / fxMultiplier);
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
  }, [activeSymbol, timeframe, fxMultiplier, showMA, showVolume]);

  useEffect(() => {
    loadChartData();
  }, [loadChartData]);

  // Simulate Flashblocks 0.2s live stream tick
  useEffect(() => {
    const interval = setInterval(() => {
      if (!candleSeriesRef.current) return;
      const noise = (Math.random() - 0.495) * 0.0015;
      const updatedPriceUSD = lastPrice * (1 + noise);
      setLastPrice(updatedPriceUSD);

      const now = Math.floor(Date.now() / 1000);
      const convertedClose = updatedPriceUSD * fxMultiplier;

      candleSeriesRef.current.update({
        time: now as any,
        open: convertedClose * (1 - noise * 0.5),
        high: convertedClose * 1.0005,
        low: convertedClose * 0.9995,
        close: convertedClose,
      });
    }, 200); // 200ms Giwa Flashblocks speed

    return () => clearInterval(interval);
  }, [activeSymbol, lastPrice, fxMultiplier]);

  const symbolsList: ChartSymbol[] = ["ETH", "BTC", "KRWC", "HANOK", "GIWA"];

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
                padding: "4px 10px",
                borderRadius: 8,
                border: activeSymbol === s ? "1px solid var(--primary)" : "1px solid transparent",
                background: activeSymbol === s ? "oklch(0.6724 0.1308 38.7559 / 0.15)" : "transparent",
                color: activeSymbol === s ? "var(--primary)" : "var(--muted-foreground)",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {s}/USDC
            </button>
          ))}
        </div>

        {/* Live Flashblocks & Price Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Zap size={14} color="var(--primary)" />
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)" }}>0.2s Flashblocks</span>
          </div>
          <div className="prism-mono" style={{ fontSize: 14, fontWeight: 800, color: "var(--foreground)" }}>
            {formatCurrencyValue(lastPrice)}
          </div>
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
                padding: "3px 8px",
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
              padding: "3px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: showMA ? "oklch(0.6724 0.1308 38.7559 / 0.15)" : "transparent",
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
              padding: "3px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: showVolume ? "oklch(0.6724 0.1308 38.7559 / 0.15)" : "transparent",
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
      <div style={{ height: 320, padding: "0.5rem", position: "relative" }}>
        <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      </div>
    </div>
  );
}
