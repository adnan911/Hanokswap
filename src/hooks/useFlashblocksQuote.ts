import { useState, useEffect, useRef } from "react";
import {
  getFlashblocksQuote,
  type FlashblocksQuoteParams,
  type FlashblocksQuoteResult,
} from "../lib/giwaFlashblocks";

export interface UseFlashblocksQuoteReturn {
  quote: FlashblocksQuoteResult | null;
  isLoading: boolean;
  error: string | null;
  latencyMs: number;
  isFlashblockPreconfirmed: boolean;
  refetch: () => void;
}

export function useFlashblocksQuote(
  params: FlashblocksQuoteParams | null,
  debounceMs: number = 150
): UseFlashblocksQuoteReturn {
  const [quote, setQuote] = useState<FlashblocksQuoteResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [isFlashblockPreconfirmed, setIsFlashblockPreconfirmed] = useState<boolean>(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const queryCountRef = useRef<number>(0);

  const executeQuote = async () => {
    if (!params || !params.amountIn || Number(params.amountIn) <= 0) {
      setQuote(null);
      setIsLoading(false);
      setError(null);
      setLatencyMs(0);
      setIsFlashblockPreconfirmed(false);
      return;
    }

    const currentQueryId = ++queryCountRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = await getFlashblocksQuote(params);

      // Guard against race conditions from out-of-order responses
      if (currentQueryId === queryCountRef.current) {
        setQuote(result);
        setLatencyMs(result.latencyMs);
        setIsFlashblockPreconfirmed(result.isFlashblockPreconfirmed);
        setIsLoading(false);
      }
    } catch (err: unknown) {
      if (currentQueryId === queryCountRef.current) {
        const message = err instanceof Error ? err.message : "Failed to fetch quote";
        setError(message);
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!params?.amountIn || Number(params.amountIn) <= 0) {
      setQuote(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(() => {
      executeQuote();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    params?.tokenIn,
    params?.tokenOut,
    params?.amountIn,
    params?.decimalsIn,
    params?.decimalsOut,
    params?.feeBps,
    params?.isStable,
    debounceMs,
  ]);

  return {
    quote,
    isLoading,
    error,
    latencyMs,
    isFlashblockPreconfirmed,
    refetch: executeQuote,
  };
}
