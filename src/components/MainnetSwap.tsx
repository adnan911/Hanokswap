import { useRef, useMemo } from "react";
import { LiFiWidget, ChainType, type WidgetConfig, type FormState } from "@lifi/widget";
import { EthereumProvider } from "@lifi/widget-provider-ethereum";
import type { EIP1193Provider } from "viem";
import { useTheme } from "../ThemeContext";
import { useLanguage } from "../LanguageContext";

export default function MainnetSwap(_props: { provider?: EIP1193Provider }) {
  const { isDark } = useTheme();
  const { language } = useLanguage();
  const formRef = useRef<FormState | null>(null);

  const lifiWidgetConfig: WidgetConfig = useMemo(() => ({
    integrator: "hanokswap",
    apiKey: import.meta.env.VITE_LIFI_API_KEY,
    providers: [EthereumProvider()],
    routePriority: "RECOMMENDED",
    variant: "compact",
    subvariant: "default",
    language: language === "ko" ? "ko" : "en",
    chains: {
      types: { allow: [ChainType.EVM] },
    },
    appearance: isDark ? "dark" : "light",
    theme: {
      colorSchemes: {
        dark: {
          palette: {
            primary: { main: "#D95333" },
            background: {
              default: "#282926",
              paper: "#353733",
            },
            text: {
              primary: "#FAF9F5",
              secondary: "#A8A69E",
            },
          },
        },
        light: {
          palette: {
            primary: { main: "#C94524" },
            background: {
              default: "#F5F4EE",
              paper: "#FAF9F5",
            },
            text: {
              primary: "#282926",
              secondary: "#737168",
            },
          },
        },
      },
      shape: {
        borderRadius: 16,
        borderRadiusSecondary: 12,
      },
      container: {
        border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 0, 0, 0.12)",
        borderRadius: 16,
        boxShadow: isDark ? "0 24px 60px -16px rgba(0,0,0,0.7), 0 0 30px rgba(217, 83, 51, 0.15)" : "0 10px 30px rgba(0,0,0,0.06)",
        background: isDark ? "#353733" : "#FAF9F5",
      },
      typography: {
        fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
    },
    fee: 0,
  }), [isDark, language]);

  return (
    <div style={{ width: "100%", maxWidth: 440, margin: "0 auto", display: "flex", justifyContent: "center" }}>
      <div className="lifi-widget-wrap" style={{ width: "100%" }}>
        <LiFiWidget integrator="hanokswap" config={lifiWidgetConfig} formRef={formRef} />
      </div>
    </div>
  );
}
