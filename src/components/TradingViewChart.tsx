import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, CandlestickSeries, ColorType, type IChartApi, type ISeriesApi } from "lightweight-charts";

interface Props {
  symbol: "BTC" | "ETH";
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const COINGECKO_ID: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum" };

const TIMEFRAMES = [
  { label: "1m", binanceInterval: "1m", limit: 120, cgDays: "1" },
  { label: "5m", binanceInterval: "5m", limit: 120, cgDays: "1" },
  { label: "15m", binanceInterval: "15m", limit: 120, cgDays: "1" },
  { label: "1H", binanceInterval: "1h", limit: 168, cgDays: "7" },
  { label: "4H", binanceInterval: "4h", limit: 180, cgDays: "30" },
  { label: "1D", binanceInterval: "1d", limit: 180, cgDays: "90" },
  { label: "1W", binanceInterval: "1w", limit: 104, cgDays: "365" },
] as const;
type TimeframeLabel = (typeof TIMEFRAMES)[number]["label"];

async function fetchFromBinance(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`);
  if (!res.ok) throw new Error("Binance request failed");
  const raw = await res.json();
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("Binance returned no data");
  return raw.map((k: any[]) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
  }));
}

async function fetchFromCoinGecko(symbol: string, days: string): Promise<Candle[]> {
  const id = COINGECKO_ID[symbol];
  const res = await fetch(`/api/coingecko-proxy?path=${encodeURIComponent(`/coins/${id}/ohlc?vs_currency=usd&days=${days}`)}`);
  if (!res.ok) throw new Error("CoinGecko request failed");
  const raw = await res.json();
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("CoinGecko returned no data");
  return raw.map((k: number[]) => ({
    time: Math.floor(k[0] / 1000),
    open: k[1],
    high: k[2],
    low: k[3],
    close: k[4],
  }));
}

export default function TradingViewChart({ symbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"binance" | "coingecko" | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeLabel>("1H");

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 280,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#818C78",
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(226,224,200,0.04)" },
        horzLines: { color: "rgba(226,224,200,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(226,224,200,0.12)" },
      timeScale: { borderColor: "rgba(226,224,200,0.12)", timeVisible: true },
      crosshair: { mode: 0 },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#A6B49E",
      downColor: "#EF4444",
      borderUpColor: "#A6B49E",
      borderDownColor: "#EF4444",
      wickUpColor: "#A6B49E",
      wickDownColor: "#EF4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    function handleResize() {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  const loadCandles = useCallback(async () => {
    const tf = TIMEFRAMES.find((t) => t.label === timeframe)!;
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    try {
      const candles = await fetchFromBinance(symbol, tf.binanceInterval, tf.limit);
      series.setData(candles as any);
      chart.timeScale().fitContent();
      setError(null);
      setSource("binance");
    } catch {
      try {
        const candles = await fetchFromCoinGecko(symbol, tf.cgDays);
        series.setData(candles as any);
        chart.timeScale().fitContent();
        setError(null);
        setSource("coingecko");
      } catch {
        setError("Could not load price data. Please refresh or try again shortly.");
      }
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    loadCandles();
    const interval = setInterval(loadCandles, 30000);
    return () => clearInterval(interval);
  }, [loadCandles]);

  return (
    <div style={{ background: "rgba(20, 28, 25, 0.72)", border: "1px solid rgba(226, 224, 200, 0.12)", borderRadius: 16, overflow: "hidden", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
      <div style={{ display: "flex", gap: 4, padding: "0.5rem 0.6rem 0" }}>
        {TIMEFRAMES.map((tf) => (
          <button key={tf.label} onClick={() => setTimeframe(tf.label)}
            style={{
              padding: "3px 9px", borderRadius: 7, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 700,
              background: timeframe === tf.label ? "rgba(166,180,158,0.2)" : "transparent",
              color: timeframe === tf.label ? "#E2E0C8" : "#818C78",
            }}>
            {tf.label}
          </button>
        ))}
      </div>
      <div style={{ height: 280, padding: "0.5rem", position: "relative" }}>
        <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
        {error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15, 20, 19, 0.9)" }}>
            <p style={{ fontSize: 12, color: "#818C78", textAlign: "center", padding: "0 1.5rem" }}>{error}</p>
          </div>
        )}
        {source === "coingecko" && !error && (
          <div style={{ position: "absolute", bottom: 6, right: 10, fontSize: 9, color: "#818C78" }}>via CoinGecko</div>
        )}
      </div>
    </div>
  );
}
