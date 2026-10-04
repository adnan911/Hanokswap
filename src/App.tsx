import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PortfolioAnalytics from "./components/PortfolioAnalytics";
import SecurityGovernancePanel from "./components/SecurityGovernancePanel";
import CopilotHomeMainnet from "./components/CopilotHomeMainnet";
import { useState, useEffect, Component, type ReactNode } from "react";
import type { EIP1193Provider } from "viem";
import { discoverWallets, restoreWalletConnect } from "./components/WalletConnect";
import ConnectModal from "./components/ConnectModal";
import OnboardingModal, { hasSeenOnboarding } from "./components/OnboardingModal";
import TxHistory from "./components/TxHistory";
import DashboardMainnet from "./components/DashboardMainnet";
import GiwaSwap from "./components/GiwaSwap";
import GiwaBridge from "./components/GiwaBridge";
import GiwaTokenDeployer from "./components/GiwaTokenDeployer";
import GiwaDocsGuide from "./components/GiwaDocsGuide";
import AiCopilotMainnet from "./components/AiCopilotMainnet";
import ToastContainer from "./components/ToastContainer";
import MarketTicker from "./components/MarketTicker";
import NotificationCenter from "./components/NotificationCenter";
import { getNickname, setNickname as saveNickname, clearNickname } from "./gamification";
import { showToast } from "./toast";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { LanguageProvider, useLanguage } from "./LanguageContext";
import { CurrencyProvider } from "./CurrencyContext";
import { CurrencySelector } from "./components/CurrencySelector";
import { KoreanTaxModal } from "./components/KoreanTaxModal";
import LanguageToggle from "./components/LanguageToggle";
import LiquidityPools from "./components/LiquidityPools";
import { UpIdBadge } from "./components/UpIdBadge";
import { DojangIdentityModal } from "./components/DojangIdentityModal";
import { useDojang } from "./hooks/useDojang";
import type { Address } from "viem";
import {
  Home, Repeat, Zap, Droplet, LayoutDashboard, BarChart3, History as HistoryIcon,
  Power, Check, Sun, Moon, ArrowRight, ArrowDown, AlertTriangle, Sparkles, Coins, BookOpen,
  FileSpreadsheet, ShieldAlert,
} from "lucide-react";

interface WalletInfo {
  provider: EIP1193Provider;
  address: string;
  walletName: string;
}

interface Balances {
  usdc: string | null;
  eurc: string | null;
  usyc: string | null;
  cirbtc: string | null;
  native: string | null;
}

type Tab = "home" | "swap" | "bridge" | "pools" | "create-token" | "docs" | "dashboard" | "analytics" | "security" | "history";

const queryClient = new QueryClient();

/* ---------- Hanok Traditional Architectural Roof Mark ---------- */
export function HanokMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
      <defs>
        <linearGradient id="hanok-grad" x1="10" y1="20" x2="90" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="oklch(0.75 0.15 45)" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="var(--muted)" stroke="var(--border)" strokeWidth="2" />
      {/* Hanok curved eaves / roof (Giwa) */}
      <path d="M16 46 Q 50 30 84 46 Q 50 20 16 46 Z" fill="url(#hanok-grad)" />
      <path d="M22 43 Q 50 24 78 43" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      {/* Traditional Wooden Pillars */}
      <rect x="28" y="47" width="5" height="25" rx="2" fill="var(--primary)" />
      <rect x="67" y="47" width="5" height="25" rx="2" fill="var(--primary)" />
      <rect x="47" y="47" width="6" height="25" rx="2" fill="var(--foreground)" opacity="0.8" />
      {/* Foundation Platform */}
      <path d="M18 72 H82" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" />
      {/* Subtle top spire accent */}
      <circle cx="50" cy="24" r="3.5" fill="var(--primary)" />
    </svg>
  );
}

function HanokBackground() {
  const { isDark } = useTheme();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{
        position: "absolute", inset: 0,
        background: isDark
          ? "radial-gradient(circle at 50% -10%, oklch(0.32 0.015 40 / 0.35) 0%, var(--background) 70%)"
          : "radial-gradient(circle at 50% -10%, oklch(0.92 0.03 45 / 0.35) 0%, var(--background) 70%)",
        transition: "background 0.3s ease",
      }} />
      <div style={{ position: "absolute", top: "-15%", left: "15%", width: "45vw", height: "45vw", background: "radial-gradient(circle, oklch(0.6724 0.1308 38.7559 / 0.18) 0%, transparent 70%)", filter: "blur(70px)" }} />
      <div style={{ position: "absolute", top: "25%", right: "-10%", width: "40vw", height: "40vw", background: "radial-gradient(circle, oklch(0.6171 0.1375 39.0427 / 0.14) 0%, transparent 70%)", filter: "blur(80px)" }} />
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: isDark
          ? "linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)"
          : "linear-gradient(rgba(0, 0, 0, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.04) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        maskImage: "radial-gradient(ellipse at 50% 50%, black 40%, transparent 80%)",
        WebkitMaskImage: "radial-gradient(ellipse at 50% 50%, black 40%, transparent 80%)",
      }} />
    </div>
  );
}

/* ---------- Google Fonts injection ---------- */
function useHanokFonts() {
  useEffect(() => {
    if (document.getElementById("hanok-fonts")) return;
    const link = document.createElement("link");
    link.id = "hanok-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);
}

/* ---------- Error boundary ---------- */
class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError(err: unknown) {
    return { hasError: true, message: err instanceof Error ? err.message : "Something went wrong." };
  }
  componentDidCatch(err: unknown) {
    console.error("HanokSwap render error:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "var(--background)", color: "var(--foreground)", padding: "2rem", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--muted)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertTriangle size={32} color="var(--primary)" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)" }}>HanokSwap encountered an issue</div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", maxWidth: 420 }}>{this.state.message}</div>
          <button onClick={() => window.location.reload()}
            style={{ padding: "0.75rem 1.75rem", borderRadius: 12, border: "none", background: "var(--primary)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px oklch(0.6724 0.1308 38.7559 / 0.4)" }}>
            Reload HanokSwap
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <CurrencyProvider>
          <AppErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <AppInner />
            </QueryClientProvider>
          </AppErrorBoundary>
        </CurrencyProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

function AppInner() {
  useHanokFonts();
  const { t, language } = useLanguage();

  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showDojangModal, setShowDojangModal] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 860);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { profile: dojangProfile } = useDojang(wallet?.address as Address | undefined);

  const navTabs = [
    { id: "home" as Tab, label: t.home, Icon: Home },
    { id: "swap" as Tab, label: t.swap, Icon: Repeat },
    { id: "bridge" as Tab, label: t.bridge, Icon: Zap },
    { id: "pools" as Tab, label: t.pools, Icon: Droplet },
    { id: "create-token" as Tab, label: t.createToken, Icon: Coins },
    { id: "docs" as Tab, label: t.docs, Icon: BookOpen },
    { id: "dashboard" as Tab, label: t.portfolio, Icon: LayoutDashboard },
    { id: "analytics" as Tab, label: t.analytics, Icon: BarChart3 },
    { id: "security" as Tab, label: language === "ko" ? "보안 및 거버넌스" : "Security & Risk", Icon: ShieldAlert },
    { id: "history" as Tab, label: t.history, Icon: HistoryIcon },
  ];

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth <= 860); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [tab, setTab] = useState<Tab>("home");
  const [balances] = useState<Balances>({ usdc: null, eurc: null, usyc: null, cirbtc: null, native: null });
  const [copied, setCopied] = useState(false);
  const [nickname, setNicknameState] = useState<string | null>(null);

  useEffect(() => {
    setNicknameState(getNickname());
  }, []);

  useEffect(() => {
    let lastRdns: string | null = null;
    try { lastRdns = localStorage.getItem("hanok-last-wallet-rdns") || localStorage.getItem("flowfi-last-wallet-rdns"); } catch {}
    if (!lastRdns) return;
    if (lastRdns === "walletconnect") {
      restoreWalletConnect()
        .then((p) => { if (p) handleConnected(p as unknown as EIP1193Provider, p.accounts[0], "WalletConnect"); })
        .catch(() => {});
      return;
    }
    (async () => {
      const found = await discoverWallets();
      const match = found.find((w) => w.info.rdns === lastRdns);
      if (!match) return;
      try {
        const accounts = (await match.provider.request({ method: "eth_accounts", params: undefined })) as string[];
        if (accounts[0]) handleConnected(match.provider, accounts[0], match.info.name);
      } catch {
        // silent connect failed
      }
    })();
  }, []);

  function disconnectWallet() {
    try {
      localStorage.removeItem("hanok-last-wallet-rdns");
      localStorage.removeItem("flowfi-last-wallet-rdns");
    } catch {}
    const p = wallet?.provider as unknown as { disconnect?: () => Promise<void> } | undefined;
    if (wallet?.walletName === "WalletConnect" && p?.disconnect) p.disconnect().catch(() => {});
    setWallet(null);
  }

  useEffect(() => {
    const provider = wallet?.provider;
    if (!provider) return;
    const onAccountsChanged = (accounts: string[]) => {
      setWallet((current) => current?.provider === provider
        ? accounts[0] ? { ...current, address: accounts[0] } : null
        : current);
    };
    const onDisconnect = () => onAccountsChanged([]);
    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("disconnect", onDisconnect);
    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("disconnect", onDisconnect);
    };
  }, [wallet?.provider]);

  function handleConnected(provider: EIP1193Provider, address: string, walletName: string) {
    setWallet({ provider, address, walletName });
    setGuestMode(false);
    setShowConnectModal(false);
    setTab("home");
    showToast(t.walletConnected, "success");
    if (!hasSeenOnboarding()) setShowOnboarding(true);
  }

  function goToTab(id: Tab) {
    setTab(id);
    if (isMobile) setMobileMenuOpen(false);
  }

  async function copyAddress() {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      showToast(t.addressCopied, "success");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("Could not copy address", "error");
    }
  }

  const shortAddr = wallet ? wallet.address.slice(0, 6) + "..." + wallet.address.slice(-4) : "";
  const { isDark, toggleTheme } = useTheme();

  /* ---------- Landing Page for disconnected state when tab === 'home' ---------- */
  if (!wallet && !guestMode && tab === "home") {
    return (
      <div style={{ minHeight: "100vh", position: "relative", color: "var(--foreground)", background: "var(--background)", overflowX: "hidden" }}>
        <HanokBackground />
        <ToastContainer />
        {/* Navigation Bar */}
        <nav style={{ position: "relative", zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center", padding: isMobile ? "1rem 1.25rem" : "1.25rem 3rem", borderBottom: "1px solid var(--border)", backdropFilter: "blur(20px)", background: "var(--card)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <HanokMark size={36} />
            <span className="prism-display" style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              Hanok<span style={{ color: "var(--primary)" }}>Swap</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CurrencySelector />
            <LanguageToggle compact />
            <button onClick={toggleTheme} aria-label="Toggle theme"
              style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {isDark ? <Sun size={17} color="var(--primary)" /> : <Moon size={17} color="var(--primary)" />}
            </button>
            <button onClick={() => { setGuestMode(true); setTab("swap"); }}
              style={{ padding: "0.55rem 1.1rem", borderRadius: 12, border: "1px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {t.launchApp}
            </button>
            <button onClick={() => setShowConnectModal(true)}
              style={{ padding: "0.55rem 1.3rem", borderRadius: 12, border: "none", background: "var(--primary)", color: "#FFFFFF", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 16px oklch(0.6724 0.1308 38.7559 / 0.35)" }}>
              {t.connectWallet}
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1240, margin: "0 auto", padding: isMobile ? "2.5rem 1.25rem 2rem" : "4rem 2.5rem 3rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", gap: isMobile ? 32 : 48, alignItems: "center" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "var(--muted)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--primary)", marginBottom: 18 }}>
                <Zap size={14} className="prism-live-dot" /> {t.heroBadge}
              </div>
              <h1 className="prism-display" style={{ fontSize: isMobile ? 36 : 56, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.035em", color: "var(--foreground)", margin: "0 0 1rem 0" }}>
                {t.heroTitle1}<br />
                <span style={{ background: "linear-gradient(135deg, var(--foreground) 0%, var(--primary) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {t.heroTitle2}
                </span>
              </h1>
              <p style={{ fontSize: isMobile ? 14.5 : 16, color: "var(--muted-foreground)", lineHeight: 1.5, maxWidth: 500, margin: "0 0 1.75rem 0" }}>
                {t.heroSubtitle}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <button onClick={() => setShowConnectModal(true)}
                  style={{ padding: "0.85rem 1.85rem", borderRadius: 14, border: "none", background: "var(--primary)", color: "#FFFFFF", fontSize: 14.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 6px 24px oklch(0.6724 0.1308 38.7559 / 0.4)", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {t.connectWallet} <ArrowRight size={16} />
                </button>
                <button onClick={() => { setGuestMode(true); setTab("swap"); }}
                  style={{ padding: "0.85rem 1.6rem", borderRadius: 14, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 14.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Repeat size={16} /> {t.swap}
                </button>
                <button onClick={() => { setGuestMode(true); setTab("create-token"); }}
                  style={{ padding: "0.85rem 1.6rem", borderRadius: 14, border: "1px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", fontSize: 14.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Coins size={16} color="var(--primary)" /> {t.createToken}
                </button>
              </div>
            </div>

            {/* Interactive Live Mini-Swap Card */}
            <div style={{ width: "100%", maxWidth: 460, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, padding: "1.75rem", boxShadow: "0 24px 60px rgba(0, 0, 0, 0.4), 0 0 40px oklch(0.6724 0.1308 38.7559 / 0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <HanokMark size={26} />
                  <span className="prism-display" style={{ fontWeight: 800, fontSize: 15, color: "var(--foreground)" }}>Giwa DEX Core</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "oklch(0.6724 0.1308 38.7559 / 0.12)", border: "1px solid oklch(0.6724 0.1308 38.7559 / 0.25)", padding: "3px 8px", borderRadius: 8 }}>
                  <Zap size={12} color="var(--primary)" />
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--primary)" }}>0.2s FLASHBLOCKS</span>
                </div>
              </div>

              <div style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--muted-foreground)", marginBottom: 4 }}>
                  <span>{t.youPay}</span>
                  <span>{t.balance}: 1.50 ETH</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="prism-mono" style={{ fontSize: 24, fontWeight: 800, color: "var(--foreground)" }}>1.00</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--card)", border: "1px solid var(--border)", padding: "5px 10px", borderRadius: 999, fontWeight: 700, fontSize: 13, color: "var(--foreground)" }}>
                    <span style={{ fontSize: 14 }}>⟠</span> ETH
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", margin: "-12px 0", position: "relative", zIndex: 2 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--card)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                  <ArrowDown size={13} />
                </div>
              </div>

              <div style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem", marginTop: 4, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--muted-foreground)", marginBottom: 4 }}>
                  <span>{t.youReceive}</span>
                  <span style={{ color: "var(--primary)", fontWeight: 700 }}>1 ETH = 3,150.00 USDC</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="prism-mono" style={{ fontSize: 24, fontWeight: 800, color: "var(--foreground)" }}>3,150.00</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--card)", border: "1px solid var(--border)", padding: "5px 10px", borderRadius: 999, fontWeight: 700, fontSize: 13, color: "var(--foreground)" }}>
                    <span style={{ fontSize: 14 }}>💵</span> USDC
                  </span>
                </div>
              </div>

              <button onClick={() => { setGuestMode(true); setTab("swap"); }}
                style={{ width: "100%", padding: "0.85rem", borderRadius: 14, border: "none", background: "var(--primary)", color: "#FFFFFF", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px oklch(0.6724 0.1308 38.7559 / 0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Repeat size={16} /> {t.connectAndTrade}
              </button>
            </div>
          </div>
        </div>

        {/* Live Telemetry Strip */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1240, margin: "0 auto 2rem", padding: isMobile ? "0 1.25rem" : "0 2.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "PRECONFIRMATION", value: "0.2s", sub: "Flashblocks Speed", icon: Zap },
              { label: "GAS", value: "Variable", sub: "Estimated by wallet", icon: Sparkles },
              { label: "GIWA CHAIN ID", value: "91342", sub: "Sepolia Testnet", icon: HanokMark },
              { label: "CUSTODY", value: "Your wallet", sub: "Wallet-signed swaps", icon: Check },
            ].map((stat, i) => (
              <div key={i} style={{ padding: "14px 18px", borderRadius: 16, background: "var(--card)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted-foreground)", letterSpacing: "0.5px" }}>{stat.label}</div>
                  <div className="prism-mono" style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", marginTop: 2 }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: "var(--primary)", fontWeight: 600 }}>{stat.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4-Card Bento Action Hub (Ultra-Premium, Less Text) */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1240, margin: "0 auto", padding: isMobile ? "1rem 1.25rem 3rem" : "1rem 2.5rem 4rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 18 }}>
            {/* Card 1: Swap */}
            <div
              onClick={() => { setGuestMode(true); setTab("swap"); }}
              style={{ padding: "24px", borderRadius: 20, background: "var(--card)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16, transition: "transform 0.15s ease, border-color 0.15s ease" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: "oklch(0.6724 0.1308 38.7559 / 0.12)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Repeat size={22} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 8, background: "var(--muted)", color: "var(--foreground)" }}>
                  0.2s PRECONFIRMATION
                </span>
              </div>
              <div>
                <h3 className="prism-display" style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", margin: "0 0 6px 0" }}>
                  {language === "ko" ? "초고속 DEX 스왑" : "Instant DEX Swap"}
                </h3>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
                  {language === "ko" ? "GIWA Sepolia 스왑 미리보기. 실제 거래에는 배포된 토큰과 유동성이 필요합니다." : "Preview GIWA Sepolia swaps. Live trading requires deployed tokens and funded pools."}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
                <span>{language === "ko" ? "스왑 시작하기" : "Trade Now"}</span>
                <ArrowRight size={14} />
              </div>
            </div>

            {/* Card 2: Token Deployer */}
            <div
              onClick={() => { setGuestMode(true); setTab("create-token"); }}
              style={{ padding: "24px", borderRadius: 20, background: "var(--card)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16, transition: "transform 0.15s ease, border-color 0.15s ease" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: "oklch(0.6898 0.1581 290.4107 / 0.12)", color: "oklch(0.6898 0.1581 290.4107)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Coins size={22} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 8, background: "var(--muted)", color: "var(--foreground)" }}>
                  LOCAL PREVIEW
                </span>
              </div>
              <div>
                <h3 className="prism-display" style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", margin: "0 0 6px 0" }}>
                  {language === "ko" ? "1-클릭 토큰 발행기" : "1-Click Token Deployer"}
                </h3>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
                  {language === "ko" ? "토큰 생성 화면을 미리 볼 수 있습니다. 온체인 배포는 연결되지 않았습니다." : "Preview token creation. On-chain deployment is not connected."}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
                <span>{language === "ko" ? "토큰 발행하기" : "Create Token"}</span>
                <ArrowRight size={14} />
              </div>
            </div>

            {/* Card 3: Pools */}
            <div
              onClick={() => { setGuestMode(true); setTab("pools"); }}
              style={{ padding: "24px", borderRadius: 20, background: "var(--card)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16, transition: "transform 0.15s ease, border-color 0.15s ease" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: "oklch(0.7 0.15 160 / 0.12)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Droplet size={22} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 8, background: "var(--muted)", color: "var(--foreground)" }}>
                  CLAMM &amp; STABLESWAP
                </span>
              </div>
              <div>
                <h3 className="prism-display" style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", margin: "0 0 6px 0" }}>
                  {language === "ko" ? "유동성 풀 & 수수료 보상" : "Liquidity Pools & Yield"}
                </h3>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
                  {language === "ko" ? "스테이블 풀을 탐색하세요. 집중 유동성 쓰기는 포지션 매니저 연결 전까지 비활성화됩니다." : "Explore stable pools. Concentrated liquidity writes require a position manager and are disabled."}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
                <span>{language === "ko" ? "풀 둘러보기" : "Explore Pools"}</span>
                <ArrowRight size={14} />
              </div>
            </div>

            {/* Card 4: Bridge & Faucet */}
            <div
              onClick={() => { setGuestMode(true); setTab("bridge"); }}
              style={{ padding: "24px", borderRadius: 20, background: "var(--card)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16, transition: "transform 0.15s ease, border-color 0.15s ease" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: "oklch(0.75 0.18 55 / 0.12)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Zap size={22} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 8, background: "var(--muted)", color: "var(--foreground)" }}>
                  FREE TESTNET ASSETS
                </span>
              </div>
              <div>
                <h3 className="prism-display" style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", margin: "0 0 6px 0" }}>
                  {language === "ko" ? "테스트넷 브릿지 & 수도꼭지" : "Testnet Bridge & Faucet"}
                </h3>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
                  {language === "ko" ? "공식 GIWA ETH 수도꼭지를 이용하거나 Sepolia L1에서 ETH를 브릿지하세요." : "Use the official GIWA ETH faucet or bridge ETH from Sepolia L1."}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
                <span>{language === "ko" ? "토큰 받기 (Claim)" : "Claim Faucet"}</span>
                <ArrowRight size={14} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{ position: "relative", zIndex: 1, background: "var(--card)", borderTop: "1px solid var(--border)", padding: "2.5rem 2rem 1.5rem" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "2rem" }}>
            <div style={{ maxWidth: 360 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <HanokMark size={30} />
                <span className="prism-display" style={{ fontSize: 18, fontWeight: 800, color: "var(--foreground)" }}>Hanok<span style={{ color: "var(--primary)" }}>Swap</span></span>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                {t.footerDesc}
              </p>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 10 }}>{t.pools} &amp; {t.swap}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button onClick={() => { setGuestMode(true); setTab("swap"); }} style={{ background: "none", border: "none", padding: 0, textAlign: "left", fontSize: 12.5, color: "var(--muted-foreground)", cursor: "pointer" }}>{t.swap}</button>
                <button onClick={() => { setGuestMode(true); setTab("bridge"); }} style={{ background: "none", border: "none", padding: 0, textAlign: "left", fontSize: 12.5, color: "var(--muted-foreground)", cursor: "pointer" }}>{t.bridge}</button>
                <button onClick={() => { setGuestMode(true); setTab("pools"); }} style={{ background: "none", border: "none", padding: 0, textAlign: "left", fontSize: 12.5, color: "var(--muted-foreground)", cursor: "pointer" }}>{t.pools}</button>
                <button onClick={() => { setGuestMode(true); setTab("create-token"); }} style={{ background: "none", border: "none", padding: 0, textAlign: "left", fontSize: 12.5, color: "var(--muted-foreground)", cursor: "pointer" }}>{t.createToken}</button>
                <button onClick={() => { setGuestMode(true); setTab("docs"); }} style={{ background: "none", border: "none", padding: 0, textAlign: "left", fontSize: 12.5, color: "var(--muted-foreground)", cursor: "pointer" }}>{t.docs}</button>
              </div>
            </div>
          </div>
          <div style={{ maxWidth: 1200, margin: "1.5rem auto 0", paddingTop: "1rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted-foreground)" }}>
            <span>{t.footerRights}</span>
            <span>{t.nonCustodialTag}</span>
          </div>
        </footer>

        {showConnectModal && <ConnectModal onClose={() => setShowConnectModal(false)} onConnected={handleConnected} />}
      </div>
    );
  }

  /* ---------- App Dashboard View ---------- */
  return (
    <div style={{ minHeight: "100vh", display: "flex", color: "var(--foreground)", position: "relative", background: "var(--background)", transition: "background 0.3s ease, color 0.3s ease" }}>
      <HanokBackground />
      <ToastContainer />
      {isMobile && mobileMenuOpen && (
        <div onClick={() => setMobileMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 100 }} />
      )}

      {/* Sidebar */}
      <aside inert={isMobile && !mobileMenuOpen} style={{
        width: 240, height: "100vh", background: "var(--card)", backdropFilter: "blur(24px)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", padding: "1.5rem 0", overflow: "hidden",
        position: isMobile ? "fixed" : "sticky", top: 0, left: isMobile && !mobileMenuOpen ? -260 : 0, zIndex: 101,
        transition: "left 0.22s cubic-bezier(0.16, 1, 0.3, 1)", flexShrink: 0,
      }}>
        <div style={{ padding: "0 1.25rem 1.25rem", marginBottom: "0.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <HanokMark size={32} />
            <div>
              <div className="prism-display" style={{ fontSize: 18, fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                Hanok<span style={{ color: "var(--primary)" }}>Swap</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ flex: 1, padding: "0 0.75rem", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
          {navTabs.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => goToTab(id)}
                style={{
                  width: "100%", height: 42, padding: "0 0.85rem", borderRadius: 12,
                  border: active ? "1px solid var(--primary)" : "1px solid transparent",
                  background: active ? "oklch(0.6724 0.1308 38.7559 / 0.12)" : "transparent",
                  color: active ? "var(--foreground)" : "var(--muted-foreground)",
                  fontSize: 13.5, fontWeight: active ? 700 : 500, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 11, textAlign: "left",
                  transition: "all 0.15s ease",
                }}>
                <Icon size={17} strokeWidth={active ? 2.4 : 1.8} color={active ? "var(--primary)" : "var(--muted-foreground)"} />
                <span style={{ flex: 1 }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* User Account / Connection in Sidebar */}
        <div style={{ padding: "0.5rem 0.75rem", marginTop: "auto" }}>
          {wallet ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 14, background: "var(--muted)", border: "1px solid var(--border)" }}>
              <button onClick={copyAddress} title="Copy address" aria-label="Copy address"
                style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "var(--primary)", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0, cursor: "pointer" }}>
                {copied ? <Check size={16} /> : (nickname || wallet.address.slice(2)).charAt(0).toUpperCase()}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <button onClick={() => {
                  const next = window.prompt("Set a local nickname (visible only on this browser):", nickname ?? "");
                  if (next === null) return;
                  if (next.trim()) { setNicknameState(next.trim()); saveNickname(next.trim()); }
                  else { setNicknameState(null); clearNickname(); }
                }} title="Click to set nickname"
                  style={{ display: "block", maxWidth: "100%", padding: 0, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>
                  {nickname || shortAddr}
                </button>
              </div>
              <button onClick={disconnectWallet} title="Disconnect" aria-label="Disconnect"
                style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "var(--card)", color: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <Power size={14} />
              </button>
            </div>
          ) : (
            <div style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 14, padding: "0.85rem" }}>
              <div style={{ fontSize: 10, color: "var(--primary)", fontWeight: 800, letterSpacing: "1px", marginBottom: 4 }}>{t.guestMode}</div>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "0 0 10px 0", lineHeight: 1.45 }}>{t.guestModeDesc}</p>
              <button onClick={() => setShowConnectModal(true)} style={{ fontSize: 12, color: "#FFFFFF", background: "var(--primary)", border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer", width: "100%", fontWeight: 800, boxShadow: "0 4px 14px oklch(0.6724 0.1308 38.7559 / 0.35)" }}>{t.connectWallet}</button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, minHeight: "100vh", position: "relative", zIndex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ flex: 1 }}>
          {isMobile && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1rem", background: "var(--card)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10 }}>
              <button aria-label="Open navigation" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)} style={{ background: "none", border: "none", fontSize: 20, color: "var(--foreground)", cursor: "pointer", padding: "4px 8px" }}>
                ☰
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <HanokMark size={24} />
                <span className="prism-display" style={{ fontSize: 15, fontWeight: 800, color: "var(--foreground)" }}>Hanok<span style={{ color: "var(--primary)" }}>Swap</span></span>
              </div>
              <div style={{ width: 32 }} />
            </div>
          )}

          <MarketTicker />

          {/* Header */}
          <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: 10, padding: isMobile ? "0.85rem 1rem" : "1rem 2rem" }}>
            <CurrencySelector />
            <button
              onClick={() => setShowTaxModal(true)}
              title={language === 'ko' ? '국세청(NTS) 가상자산 세금 계산기' : 'NTS Crypto Tax Exporter'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--foreground)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <FileSpreadsheet size={14} color="#3b82f6" />
              <span>{language === 'ko' ? 'NTS 세금계산' : 'Tax Export'}</span>
            </button>
            <LanguageToggle />
            <button onClick={toggleTheme} aria-label="Toggle theme" title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
              style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {isDark ? <Sun size={17} color="var(--primary)" /> : <Moon size={17} color="var(--primary)" />}
            </button>
            <NotificationCenter />
            <div style={{ width: 1, height: 18, background: "var(--border)" }} />
            {wallet && (
              <UpIdBadge
                profile={dojangProfile}
                onClick={() => setShowDojangModal(true)}
              />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "var(--muted)", border: "1px solid var(--border)" }}>
              <span className="prism-live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", boxShadow: "0 0 6px var(--primary)" }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--foreground)" }}>
                {t.multiChainLive}
              </span>
            </div>
            {wallet ? (
              <button onClick={() => setShowDojangModal(true)}
                className="prism-mono"
                title="Dojang Identity & Wallet"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {dojangProfile.upIdName || shortAddr}
              </button>
            ) : (
              <button onClick={() => setShowConnectModal(true)}
                style={{ padding: "8px 18px", borderRadius: 999, border: "none", background: "var(--primary)", color: "#FFFFFF", fontSize: 12.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 14px oklch(0.6724 0.1308 38.7559 / 0.35)" }}>
                {t.connectWallet}
              </button>
            )}
          </header>

          <DojangIdentityModal
            isOpen={showDojangModal}
            onClose={() => setShowDojangModal(false)}
            address={wallet?.address as Address | undefined}
          />

          <KoreanTaxModal
            isOpen={showTaxModal}
            onClose={() => setShowTaxModal(false)}
            userAddress={wallet?.address}
          />

          <div style={{ padding: isMobile ? "1rem" : "2rem" }}>
            <div key={tab} className="prism-page" style={{ maxWidth: isMobile ? "100%" : (tab === "home" ? 1200 : tab === "docs" || tab === "create-token" ? 960 : tab === "dashboard" || tab === "swap" || tab === "bridge" || tab === "history" ? 920 : 760), margin: "0 auto" }}>
              {tab !== "home" && (
                <div style={{ marginBottom: "1.75rem" }}>
                  <h1 className="prism-display" style={{ fontSize: 28, fontWeight: 800, color: "var(--foreground)", marginBottom: 6, letterSpacing: "-0.02em" }}>
                    {tab === "swap" ? t.swapTitle : tab === "bridge" ? t.bridgeTitle : tab === "pools" ? t.poolsTitle : tab === "create-token" ? t.createToken : tab === "docs" ? t.docs : tab === "dashboard" ? t.portfolioTitle : tab === "analytics" ? t.analyticsTitle : t.history}
                  </h1>
                  <p style={{ fontSize: 13.5, color: "var(--muted-foreground)" }}>
                    {tab === "swap" ? t.swapSubtitle : tab === "bridge" ? t.bridgeSubtitle : tab === "pools" ? t.poolsSubtitle : tab === "create-token" ? (t.feat3Desc) : tab === "docs" ? (t.feat4Desc) : tab === "dashboard" ? t.portfolioSubtitle : tab === "analytics" ? t.analyticsSubtitle : t.recentActivity}
                  </p>
                </div>
              )}

              {tab === "home" && <CopilotHomeMainnet address={wallet ? wallet.address : "0x0000000000000000000000000000000000000000"} balances={balances} onNavigate={(t) => setTab(t as Tab)} provider={wallet?.provider} />}
              {tab === "swap" && <GiwaSwap provider={wallet?.provider} address={wallet?.address} onNavigateToDocs={() => setTab("docs")} onNavigateToDeployer={() => setTab("create-token")} />}
              {tab === "bridge" && <GiwaBridge address={wallet?.address} provider={wallet?.provider} onNavigateToDocs={() => setTab("docs")} />}
              {tab === "pools" && <LiquidityPools provider={wallet?.provider} address={wallet?.address} />}
              {tab === "create-token" && <GiwaTokenDeployer provider={wallet?.provider} address={wallet?.address} onNavigateToPools={() => setTab("pools")} onNavigateToDocs={() => setTab("docs")} />}
              {tab === "docs" && <GiwaDocsGuide provider={wallet?.provider} onNavigateToDeployer={() => setTab("create-token")} onNavigateToPools={() => setTab("pools")} onNavigateToSwap={() => setTab("swap")} />}
              {tab === "dashboard" && <DashboardMainnet address={wallet ? wallet.address : "0x0000000000000000000000000000000000000000"} balances={balances} provider={wallet?.provider} onNavigate={(t) => setTab(t as Tab)} />}
              {tab === "analytics" && (
                <PortfolioAnalytics
                  userAddress={wallet?.address}
                  onNavigateToPools={() => setTab("pools")}
                  onNavigateToSwap={() => setTab("swap")}
                />
              )}
              {tab !== "docs" && (
                <p role="note" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                  {language === 'ko'
                    ? '테스트넷 미리보기: 신원 배지, 지정가 주문, DCA, 토큰 출시, 파밍 및 거버넌스는 로컬 시뮬레이션이며 온체인 검증이나 거래가 아닙니다.'
                    : 'Testnet preview: identity badges, limit orders, DCA, token launches, farming, and governance are local simulations. These actions do not verify identity or execute on-chain transactions.'}
                </p>
              )}
              {tab === "security" && <SecurityGovernancePanel />}
              {tab === "history" && <TxHistory address={wallet ? wallet.address : "0x0000000000000000000000000000000000000000"} />}
            </div>
          </div>
        </div>

        {tab === "home" && (
          <footer style={{ background: "var(--card)", borderTop: "1px solid var(--border)", marginTop: 40, padding: "2.5rem 2rem 1.5rem" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "2rem" }}>
              <div style={{ maxWidth: 360 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <HanokMark size={28} />
                  <span className="prism-display" style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)" }}>Hanok<span style={{ color: "var(--primary)" }}>Swap</span></span>
                </div>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                  {t.footerDesc}
                </p>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 12 }}>{t.pools} &amp; {t.swap}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={() => setTab("swap")} style={{ background: "none", border: "none", padding: 0, textAlign: "left", fontSize: 13, color: "var(--muted-foreground)", cursor: "pointer" }}>{t.swap}</button>
                  <button onClick={() => setTab("bridge")} style={{ background: "none", border: "none", padding: 0, textAlign: "left", fontSize: 13, color: "var(--muted-foreground)", cursor: "pointer" }}>{t.bridge}</button>
                  <button onClick={() => setTab("pools")} style={{ background: "none", border: "none", padding: 0, textAlign: "left", fontSize: 13, color: "var(--muted-foreground)", cursor: "pointer" }}>{t.pools}</button>
                  <button onClick={() => setTab("create-token")} style={{ background: "none", border: "none", padding: 0, textAlign: "left", fontSize: 13, color: "var(--muted-foreground)", cursor: "pointer" }}>{t.createToken}</button>
                  <button onClick={() => setTab("docs")} style={{ background: "none", border: "none", padding: 0, textAlign: "left", fontSize: 13, color: "var(--muted-foreground)", cursor: "pointer" }}>{t.docs}</button>
                  <button onClick={() => setTab("dashboard")} style={{ background: "none", border: "none", padding: 0, textAlign: "left", fontSize: 13, color: "var(--muted-foreground)", cursor: "pointer" }}>{t.portfolio}</button>
                </div>
              </div>
            </div>
            <div style={{ maxWidth: 1200, margin: "1.5rem auto 0", paddingTop: "1rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted-foreground)" }}>
              <span>{t.footerRights}</span>
              <span>{t.nonCustodialTag}</span>
            </div>
          </footer>
        )}
      </main>

      {wallet && tab !== "home" && <AiCopilotMainnet onNavigate={(t) => setTab((t === "mainnetswap" ? "swap" : t === "mainnetbridge" ? "bridge" : t === "mainnethistory" ? "history" : t) as Tab)} />}
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
      {showConnectModal && <ConnectModal onClose={() => setShowConnectModal(false)} onConnected={handleConnected} />}
    </div>
  );
}
