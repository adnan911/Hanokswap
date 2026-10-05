import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PortfolioAnalytics from "./components/PortfolioAnalytics";
import SecurityGovernancePanel from "./components/SecurityGovernancePanel";
import { useState, useEffect, Component, type ReactNode } from "react";
import type { EIP1193Provider } from "viem";
import { discoverWallets, restoreWalletConnect } from "./components/WalletConnect";
import ConnectModal from "./components/ConnectModal";
import OnboardingModal, { hasSeenOnboarding } from "./components/OnboardingModal";
import TxHistory from "./components/TxHistory";
import GiwaPortfolio from "./components/GiwaPortfolio";
import GiwaSwap from "./components/GiwaSwap";
import GiwaBridge from "./components/GiwaBridge";
import GiwaTokenDeployer from "./components/GiwaTokenDeployer";
import GiwaDocsGuide from "./components/GiwaDocsGuide";
import ToastContainer from "./components/ToastContainer";
import MarketTicker from "./components/MarketTicker";
import NotificationCenter from "./components/NotificationCenter";
import { showToast } from "./toast";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { LanguageProvider, useLanguage } from "./LanguageContext";
import { CurrencyProvider } from "./CurrencyContext";
import { CurrencySelector } from "./components/CurrencySelector";
import { KoreanTaxModal } from "./components/KoreanTaxModal";
import LanguageToggle from "./components/LanguageToggle";
import LiquidityPools from "./components/LiquidityPools";
import { DojangIdentityModal } from "./components/DojangIdentityModal";
import { useDojang } from "./hooks/useDojang";
import { formatUpIdDisplay } from "./lib/dojang";
import type { Address } from "viem";
import {
  Repeat, Droplet, LayoutDashboard, BarChart3, History as HistoryIcon,
  Power, Check, Copy, Sun, Moon, Zap, Coins, BookOpen,
  ShieldAlert, Menu, X, Sparkles, Award, ShieldCheck, FileText
} from "lucide-react";

interface WalletInfo {
  provider: EIP1193Provider;
  address: string;
  walletName: string;
}

type Tab = "swap" | "pools" | "create-token" | "bridge" | "dashboard" | "analytics" | "docs" | "security" | "history";

const queryClient = new QueryClient();

/* ---------- Hanok Traditional Architectural Roof Mark ---------- */
export function HanokMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
      <defs>
        <linearGradient id="hanok-grad" x1="10" y1="20" x2="90" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="#FF784E" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="var(--card-solid, #131823)" stroke="var(--border)" strokeWidth="2" />
      {/* Hanok curved roof */}
      <path d="M16 46 Q 50 28 84 46 Q 50 18 16 46 Z" fill="url(#hanok-grad)" />
      <path d="M22 43 Q 50 24 78 43" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      {/* Wooden Pillars */}
      <rect x="28" y="47" width="5" height="25" rx="2" fill="var(--primary)" />
      <rect x="67" y="47" width="5" height="25" rx="2" fill="var(--primary)" />
      <rect x="47" y="47" width="6" height="25" rx="2" fill="var(--foreground)" opacity="0.8" />
      {/* Base */}
      <path d="M18 72 H82" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="50" cy="24" r="3.5" fill="var(--primary)" />
    </svg>
  );
}

function AmbientGlowBackground() {
  const { isDark } = useTheme();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        top: "-180px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "700px",
        height: "500px",
        background: isDark
          ? "radial-gradient(circle, rgba(255, 90, 54, 0.15) 0%, rgba(255, 90, 54, 0.04) 45%, transparent 70%)"
          : "radial-gradient(circle, rgba(234, 88, 12, 0.12) 0%, rgba(234, 88, 12, 0.03) 45%, transparent 70%)",
        filter: "blur(60px)",
      }} />
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: isDark
          ? "radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px)"
          : "radial-gradient(rgba(0, 0, 0, 0.04) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        maskImage: "radial-gradient(ellipse at 50% 30%, black 50%, transparent 85%)",
        WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 50%, transparent 85%)",
      }} />
    </div>
  );
}

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
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--card)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={32} color="var(--primary)" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>HanokSwap encountered an issue</div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", maxWidth: 420 }}>{this.state.message}</div>
          <button onClick={() => window.location.reload()} className="uniswap-btn-primary" style={{ width: "auto", padding: "10px 24px" }}>
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
  const { t, language } = useLanguage();
  const { isDark, toggleTheme } = useTheme();

  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showDojangModal, setShowDojangModal] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 960);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("swap");
  const [copied, setCopied] = useState(false);

  const { profile: dojangProfile } = useDojang(wallet?.address as Address | undefined);

  const navTabs = [
    { id: "swap" as Tab, label: language === "ko" ? "스왑" : "Trade", Icon: Repeat },
    { id: "pools" as Tab, label: language === "ko" ? "풀" : "Pools", Icon: Droplet },
    { id: "create-token" as Tab, label: language === "ko" ? "토큰 발행" : "Deploy Token", Icon: Coins },
    { id: "bridge" as Tab, label: language === "ko" ? "브릿지" : "Bridge", Icon: Zap },
    { id: "dashboard" as Tab, label: language === "ko" ? "포트폴리오" : "Portfolio", Icon: LayoutDashboard },
    { id: "analytics" as Tab, label: language === "ko" ? "통계" : "Analytics", Icon: BarChart3 },
    { id: "docs" as Tab, label: language === "ko" ? "문서" : "Docs", Icon: BookOpen },
    { id: "security" as Tab, label: language === "ko" ? "보안" : "Security", Icon: ShieldAlert },
    { id: "history" as Tab, label: language === "ko" ? "기록" : "History", Icon: HistoryIcon },
  ];

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth <= 960); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
    setShowConnectModal(false);
    showToast(t.walletConnected, "success");
    if (!hasSeenOnboarding()) setShowOnboarding(true);
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

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", background: "var(--background)", color: "var(--foreground)" }}>
      <AmbientGlowBackground />
      <ToastContainer />

      {/* Floating Uniswap-Style Top Navigation */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          background: "var(--header-bg)",
          borderBottom: "1px solid var(--border)",
          padding: isMobile ? "0.75rem 1rem" : "0.85rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        {/* Left: Brand + Chain Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            onClick={() => setTab("swap")}
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          >
            <HanokMark size={34} />
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--foreground)" }}>
              Hanok<span style={{ color: "var(--primary)" }}>Swap</span>
            </span>
          </div>

          {!isMobile && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 9999,
                background: "var(--secondary)",
                border: "1px solid var(--border)",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--muted-foreground)",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
              <span>GIWA Sepolia</span>
              <span style={{ color: "var(--primary)", fontSize: 10 }}>0.2s</span>
            </div>
          )}
        </div>

        {/* Right: Controls & Wallet */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isMobile && <CurrencySelector />}
          {!isMobile && <LanguageToggle compact />}

          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--secondary)",
              color: "var(--foreground)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {isDark ? <Sun size={16} color="var(--primary)" /> : <Moon size={16} color="var(--primary)" />}
          </button>

          <NotificationCenter />

          {/* Unified Connected Wallet & Identity Pill */}
          {wallet ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 6px 4px 12px",
                borderRadius: 9999,
                background: "var(--secondary)",
                border: "1px solid var(--border)",
              }}
            >
              {/* Identity Handle / Claim up.id Link */}
              <button
                onClick={() => setShowDojangModal(true)}
                title="Dojang Identity & up.id Profile"
                style={{
                  background: "none",
                  border: "none",
                  color: dojangProfile?.upIdName ? "var(--primary)" : "var(--muted-foreground)",
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "2px 0",
                }}
              >
                {dojangProfile?.isVIPTrader ? (
                  <Award size={13} color="#f59e0b" />
                ) : dojangProfile?.isKYCVerified ? (
                  <ShieldCheck size={13} color="#3b82f6" />
                ) : (
                  <Sparkles size={13} color="var(--primary)" />
                )}
                <span>
                  {dojangProfile?.upIdName ? formatUpIdDisplay(dojangProfile.upIdName) : "Claim up.id"}
                </span>
                {dojangProfile?.feeDiscountPercent > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 5px",
                      borderRadius: 6,
                      background: dojangProfile.isVIPTrader ? "rgba(245, 158, 11, 0.2)" : "rgba(34, 197, 94, 0.2)",
                      color: dojangProfile.isVIPTrader ? "#f59e0b" : "#22c55e",
                      fontWeight: 800,
                    }}
                  >
                    -{dojangProfile.feeDiscountPercent}%
                  </span>
                )}
              </button>

              {/* Subtle divider */}
              <span style={{ width: 1, height: 14, background: "var(--border)" }} />

              {/* Address Copy Action Chip */}
              <button
                onClick={copyAddress}
                title="Click to copy wallet address"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 8px",
                  borderRadius: 8,
                  fontFamily: "var(--font-mono, inherit)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.borderColor = "var(--primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              >
                {copied ? <Check size={12} color="#22c55e" /> : <Copy size={12} color="var(--muted-foreground)" />}
                <span>{copied ? "Copied!" : shortAddr}</span>
              </button>

              {/* Disconnect Power Button */}
              <button
                onClick={disconnectWallet}
                title="Disconnect Wallet"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(255, 255, 255, 0.08)",
                  color: "var(--muted-foreground)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#ef4444";
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--muted-foreground)";
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                }}
              >
                <Power size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConnectModal(true)}
              className="uniswap-btn-primary"
              style={{ width: "auto", padding: "8px 18px", fontSize: 13.5, borderRadius: 9999 }}
            >
              {t.connectWallet || "Connect Wallet"}
            </button>
          )}

          {/* Mobile Menu Button */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--secondary)",
                color: "var(--foreground)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}
        </div>
      </header>

      {/* Mobile Drawer */}
      {isMobile && mobileMenuOpen && (
        <div
          style={{
            position: "fixed",
            top: 60,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
            background: "var(--card-solid, #131823)",
            padding: "1.5rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {navTabs.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => {
                  setTab(id);
                  setMobileMenuOpen(false);
                }}
                style={{
                  padding: "12px 16px",
                  borderRadius: 14,
                  border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
                  background: active ? "var(--accent)" : "var(--secondary)",
                  color: active ? "var(--primary)" : "var(--foreground)",
                  fontSize: 15,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left",
                }}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            );
          })}
          <div style={{ marginTop: "auto", display: "flex", gap: 8, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <CurrencySelector />
            <LanguageToggle />
          </div>
        </div>
      )}

      {/* Main Body Layout with Desktop Left Sidebar */}
      <div style={{ display: "flex", flex: 1, minHeight: "calc(100vh - 60px)", position: "relative" }}>
        {/* Left Sidebar for Desktop */}
        {!isMobile && (
          <aside className="hanok-sidebar">
            <div className="hanok-sidebar-nav">
              <div style={{ padding: "4px 8px 10px", fontSize: 11, fontWeight: 800, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {language === "ko" ? "메뉴" : "Navigation"}
              </div>
              {navTabs.map(({ id, label, Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`hanok-sidebar-item ${active ? "active" : ""}`}
                  >
                    <Icon size={17} color={active ? "var(--primary)" : "var(--muted-foreground)"} />
                    <span>{label}</span>
                    {id === "create-token" && (
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: 6,
                          background: active ? "var(--primary)" : "rgba(255, 90, 54, 0.15)",
                          color: active ? "#ffffff" : "var(--primary)",
                        }}
                      >
                        NEW
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sidebar Footer Cards / Quick Stats */}
            <div className="hanok-sidebar-footer">
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--secondary)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)" }}>Chain Status</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#22c55e" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                    Active
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--foreground)" }}>
                  <span style={{ color: "var(--muted-foreground)" }}>Block Speed</span>
                  <span style={{ fontWeight: 700, color: "var(--primary)" }}>0.2s Flashblocks</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--foreground)" }}>
                  <span style={{ color: "var(--muted-foreground)" }}>FX Engine</span>
                  <span style={{ fontWeight: 700, color: "#3b82f6" }}>Upbit Live</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setShowTaxModal(true)}
                  style={{
                    flex: 1,
                    padding: "7px 8px",
                    borderRadius: "var(--radius-sm)",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--muted-foreground)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  <FileText size={12} />
                  <span>{language === "ko" ? "세금 계산기" : "KRW Tax"}</span>
                </button>
                <button
                  onClick={() => setShowDojangModal(true)}
                  style={{
                    flex: 1,
                    padding: "7px 8px",
                    borderRadius: "var(--radius-sm)",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--muted-foreground)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  <Sparkles size={12} color="var(--primary)" />
                  <span>up.id</span>
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* Content Column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Ticker Strip */}
          <MarketTicker />

          {/* Main Content Area */}
          <main style={{ flex: 1, padding: isMobile ? "1.5rem 1rem 3rem" : "2.5rem 2rem 4rem", position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: "100%", maxWidth: tab === "swap" ? 480 : 1180 }}>
              {tab !== "swap" && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--foreground)", marginBottom: 4, letterSpacing: "-0.02em" }}>
                    {tab === "pools" ? t.poolsTitle : tab === "create-token" ? t.createToken : tab === "bridge" ? t.bridgeTitle : tab === "dashboard" ? t.portfolioTitle : tab === "analytics" ? t.analyticsTitle : tab === "docs" ? t.docs : tab === "security" ? (language === "ko" ? "보안 및 거버넌스" : "Security & Governance") : t.history}
                  </h1>
                  <p style={{ fontSize: 13.5, color: "var(--muted-foreground)" }}>
                    {tab === "pools" ? t.poolsSubtitle : tab === "create-token" ? t.feat3Desc : tab === "bridge" ? t.bridgeSubtitle : tab === "dashboard" ? t.portfolioSubtitle : tab === "analytics" ? t.analyticsSubtitle : tab === "docs" ? t.feat4Desc : ""}
                  </p>
                </div>
              )}

              {tab === "swap" && (
                <GiwaSwap
                  provider={wallet?.provider ?? null}
                  address={wallet?.address ?? null}
                  onConnect={() => setShowConnectModal(true)}
                  onNavigateToDeployer={() => setTab("create-token")}
                />
              )}
              {tab === "pools" && <LiquidityPools provider={wallet?.provider} address={wallet?.address} />}
              {tab === "create-token" && <GiwaTokenDeployer provider={wallet?.provider} address={wallet?.address} onNavigateToPools={() => setTab("pools")} onNavigateToDocs={() => setTab("docs")} />}
              {tab === "bridge" && <GiwaBridge address={wallet?.address} provider={wallet?.provider} onNavigateToDocs={() => setTab("docs")} />}
              {tab === "dashboard" && <GiwaPortfolio address={wallet?.address} provider={wallet?.provider} onNavigate={(t) => setTab(t as Tab)} />}
              {tab === "analytics" && (
                <PortfolioAnalytics
                  userAddress={wallet?.address}
                  onNavigateToPools={() => setTab("pools")}
                  onNavigateToSwap={() => setTab("swap")}
                />
              )}
              {tab === "security" && <SecurityGovernancePanel />}
              {tab === "docs" && <GiwaDocsGuide provider={wallet?.provider} onNavigateToDeployer={() => setTab("create-token")} onNavigateToPools={() => setTab("pools")} onNavigateToSwap={() => setTab("swap")} />}
              {tab === "history" && <TxHistory address={wallet ? wallet.address : "0x0000000000000000000000000000000000000000"} />}
            </div>
          </main>
        </div>
      </div>

      {/* Modals */}
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

      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
      {showConnectModal && <ConnectModal onClose={() => setShowConnectModal(false)} onConnected={handleConnected} />}
    </div>
  );
}
