import { useState } from "react";
import { Repeat, Zap, ShieldCheck, Lock } from "lucide-react";

const STORAGE_KEY = "hanokswap-onboarding-seen";

const STEPS = [
  {
    icon: Repeat,
    title: "Welcome to HanokSwap",
    body: "Sub-second decentralized trading and deep multi-currency FX liquidity for KRWC, USDC, EURC, and ETH.",
  },
  {
    icon: Zap,
    title: "0.2s Flashblocks Finality",
    body: "Execute trades with near-instant block times, minimal latency, and institutional Smart Order Routing.",
  },
  {
    icon: ShieldCheck,
    title: "Dunamu Dojang Attestation",
    body: "Zero-knowledge identity credentials and fee tiers verified natively without compromising privacy.",
  },
  {
    icon: Lock,
    title: "Non-Custodial & Secure",
    body: "Every swap and liquidity action is signed directly in your connected wallet. Your keys, your crypto.",
  },
];

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function markOnboardingSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export default function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const StepIcon = current.icon;

  function finish() {
    markOnboardingSeen();
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "2rem", width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--muted)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
            <StepIcon size={26} />
          </div>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", textAlign: "center", marginBottom: 10 }}>
          {current.title}
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.6, minHeight: 64, marginBottom: 24 }}>
          {current.body}
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 24 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                borderRadius: 999,
                background: i === step ? "var(--primary)" : "var(--border)",
                transition: "all 0.2s ease",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              style={{ flex: 1, padding: "0.75rem", borderRadius: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--foreground)", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
              Back
            </button>
          )}
          <button
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            style={{ flex: 2, padding: "0.75rem", borderRadius: 12, border: "none", background: "var(--primary)", color: "#FFFFFF", fontSize: 13.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 14px oklch(0.6724 0.1308 38.7559 / 0.35)" }}>
            {isLast ? "Get Started" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
