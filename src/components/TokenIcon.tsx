import { useState } from "react";

// Real official token logos with clean fallbacks
const TOKEN_LOGO: Record<string, string> = {
  USDC: "https://mintcdn.com/circle-167b8d39/K2XWSLhaeRomzNa1/images/assets/USDC_Token.svg?fit=max&auto=format&n=K2XWSLhaeRomzNa1&q=85&s=c89754c1e0dd17b3e1e1b0f32e256c9a",
  EURC: "https://mintcdn.com/circle-167b8d39/K2XWSLhaeRomzNa1/images/assets/EURC_Token.svg?fit=max&auto=format&n=K2XWSLhaeRomzNa1&q=85&s=aae9cb36a2c95fb27b5b6ace4bfd2b3c",
  ETH: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  WETH: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  USYC: "https://mintcdn.com/circle-167b8d39/aiB-bUrkHkvhZQyE/images/assets/USYC_Token.png?fit=max&auto=format&n=aiB-bUrkHkvhZQyE&q=85&s=bcff561a269ee14bdc298ea324250f8f",
  CIRBTC: "https://mintcdn.com/circle-167b8d39/VmGNa1qFYaZh1eRy/images/assets/cirBTC_Token.svg?fit=max&auto=format&n=VmGNa1qFYaZh1eRy&q=85&s=bd0b164706c925a022fc620e9088a7e1",
  BTC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png",
  SOL: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
  XRP: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ripple/info/logo.png",
};

const TOKEN_FALLBACK: Record<string, { letter: string; color: string }> = {
  USDC: { letter: "$", color: "#2775CA" },
  EURC: { letter: "€", color: "#22C55E" },
  ETH: { letter: "Ξ", color: "#627EEA" },
  WETH: { letter: "W", color: "#C026D3" },
  KRWC: { letter: "₩", color: "#EA580C" },
  USYC: { letter: "Y", color: "#F59E0B" },
  CIRBTC: { letter: "₿", color: "#F97316" },
  BTC: { letter: "₿", color: "#F7931A" },
  SOL: { letter: "S", color: "#14F195" },
  XRP: { letter: "X", color: "#23292F" },
};

export function TokenIcon({ symbol, size = 24 }: { symbol: string; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  const key = symbol.toUpperCase();
  const logo = TOKEN_LOGO[key];
  const fallback = TOKEN_FALLBACK[key] ?? { letter: symbol.charAt(0), color: "var(--primary, #ea580c)" };

  if (logo && !imgFailed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          background: "rgba(255, 255, 255, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={logo}
          width={size}
          height={size}
          alt={symbol}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: fallback.color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "#ffffff",
        fontWeight: 800,
        fontSize: Math.max(10, Math.floor(size * 0.46)),
        userSelect: "none",
      }}
    >
      {fallback.letter}
    </div>
  );
}
