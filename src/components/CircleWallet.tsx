import { useState, useEffect } from "react";
import { createPublicClient, http, erc20Abi, formatUnits } from "viem";
import { arcTestnet } from "../chains";
import { getCircleWallet, saveCircleWallet, forgetCircleWallet, requestCircleWalletCode, verifyCircleWalletCode, type CircleWalletInfo } from "../circleWalletHelpers";
import { useIsMobile } from "../useIsMobile";
import { USDC_ADDRESS, EURC_ADDRESS, CIRBTC_ADDRESS } from "../contracts";
import { Check, ExternalLink } from "lucide-react";

export default function CircleWallet() {
  const isMobile = useIsMobile();
  const [wallet, setWallet] = useState<CircleWalletInfo | null>(null);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<{ usdc: string; eurc: string; cirbtc: string } | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);

  useEffect(() => {
    setWallet(getCircleWallet());
  }, []);


  async function loadBalances(address: string) {
    setLoadingBalances(true);
    try {
      const client = createPublicClient({ chain: arcTestnet, transport: http() });
      const [usdc, eurc, cirbtc] = await Promise.all([
        client.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [address as `0x${string}`] }),
        client.readContract({ address: EURC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [address as `0x${string}`] }),
        client.readContract({ address: CIRBTC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [address as `0x${string}`] }),
      ]);
      setBalances({
        usdc: Number(formatUnits(usdc, 6)).toFixed(2),
        eurc: Number(formatUnits(eurc, 6)).toFixed(2),
        cirbtc: Number(formatUnits(cirbtc, 8)).toFixed(6),
      });
    } catch {
      setBalances({ usdc: "—", eurc: "—", cirbtc: "—" });
    } finally {
      setLoadingBalances(false);
    }
  }

  useEffect(() => {
    if (!wallet) { setBalances(null); return; }
    loadBalances(wallet.address);
    const interval = setInterval(() => loadBalances(wallet.address), 15000);
    return () => clearInterval(interval);
  }, [wallet]);

  async function sendCode() {
    setLoading(true);
    setError(null);
    try {
      await requestCircleWalletCode(email.trim());
      setStep("code");
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmCode() {
    setLoading(true);
    setError(null);
    try {
      const newWallet = await verifyCircleWalletCode(email.trim(), code.trim());
      setWallet(newWallet);
      saveCircleWallet(newWallet);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  function forgetWallet() {
    forgetCircleWallet();
    setWallet(null);
    setError(null);
    setBalances(null);
    setStep("email");
    setEmail("");
    setCode("");
  }

  const chainList = wallet ? Object.keys(wallet.walletsByChain) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", maxWidth: 480 }}>
      <div style={{ background: "rgba(166,180,158,0.12)", border: "1px solid rgba(166,180,158,0.25)", borderRadius: 14, padding: "0.75rem 1rem" }}>
        <p style={{ fontSize: 12.5, color: "#E2E0C8", margin: 0, lineHeight: 1.5 }}>
          Powered by Circle Developer-Controlled Wallets — no seed phrase, no browser extension. One address works across Arc, Ethereum Sepolia, Base Sepolia, and Arbitrum Sepolia.
        </p>
      </div>

      <div style={{ background: "rgba(20, 28, 25, 0.72)", backdropFilter: "blur(20px)", border: "1px solid rgba(226, 224, 200, 0.12)", borderRadius: 24, padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.1rem", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
        {!wallet && step === "email" && (
          <>
            <p style={{ fontSize: 13.5, color: "#A6B49E", margin: 0, lineHeight: 1.6 }}>
              Sign in with your email — no extension, no private key to store. We'll send a 6-digit code; your wallet is tied to your email, not just this browser, so signing in again from anywhere gets you back to the same one.
            </p>
            {error && <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "0.75rem 1rem", color: "#EF4444", fontSize: 12.5, wordBreak: "break-word" }}>{error}</div>}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              onKeyDown={(e) => { if (e.key === "Enter" && email.trim() && !loading) sendCode(); }}
              style={{ width: "100%", padding: "0.9rem 1rem", borderRadius: 14, border: "1px solid rgba(226, 224, 200, 0.12)", background: "rgba(12, 17, 15, 0.7)", fontSize: 14, color: "#E2E0C8", boxSizing: "border-box", outline: "none" }} />
            <button onClick={sendCode} disabled={loading || !email.trim()}
              style={{ width: "100%", padding: "1rem", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #4E635E, #818C78, #A6B49E)", color: "#0F1413", fontSize: 15.5, fontWeight: 800, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", cursor: loading || !email.trim() ? "not-allowed" : "pointer", opacity: loading || !email.trim() ? 0.6 : 1 }}>
              {loading ? "Sending code..." : "Send verification code"}
            </button>
          </>
        )}

        {!wallet && step === "code" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 13, color: "#A6B49E", margin: 0 }}>Enter the code sent to <strong style={{ color: "#E2E0C8" }}>{email.trim()}</strong>:</p>
              <button onClick={() => { setStep("email"); setError(null); }} style={{ background: "none", border: "none", color: "#818C78", fontSize: 12, cursor: "pointer" }}>Back</button>
            </div>
            {error && <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "0.75rem 1rem", color: "#EF4444", fontSize: 12.5, wordBreak: "break-word" }}>{error}</div>}
            <input type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6}
              onKeyDown={(e) => { if (e.key === "Enter" && code.trim() && !loading) confirmCode(); }}
              style={{ width: "100%", padding: "0.9rem 1rem", borderRadius: 14, border: "1px solid rgba(226, 224, 200, 0.12)", background: "rgba(12, 17, 15, 0.7)", fontSize: 22, letterSpacing: 6, textAlign: "center", color: "#E2E0C8", fontFamily: "ui-monospace, monospace", boxSizing: "border-box", outline: "none" }} />
            <button onClick={confirmCode} disabled={loading || !code.trim()}
              style={{ width: "100%", padding: "1rem", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #4E635E, #818C78, #A6B49E)", color: "#0F1413", fontSize: 15.5, fontWeight: 800, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", cursor: loading || !code.trim() ? "not-allowed" : "pointer", opacity: loading || !code.trim() ? 0.6 : 1 }}>
              {loading ? "Verifying..." : "Verify & continue"}
            </button>
            <button onClick={sendCode} disabled={loading} style={{ background: "none", border: "none", color: "#A6B49E", fontSize: 12.5, cursor: "pointer", padding: 0, alignSelf: "center", fontWeight: 700 }}>
              Resend code
            </button>
          </>
        )}

        {wallet && (
          <>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <p style={{ fontSize: 14.5, color: "#E2E0C8", fontWeight: 800, margin: 0 }}>Signed in as {wallet.email}</p>
              <p style={{ fontSize: 12, color: "#818C78", margin: 0, textAlign: "center" }}>Same address on every supported chain — sign in with this email from anywhere to get it back.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 8 }}>
              <div style={{ background: "rgba(15, 20, 19, 0.7)", border: "1px solid rgba(226, 224, 200, 0.08)", borderRadius: 12, padding: "0.75rem", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#818C78", fontWeight: 700, letterSpacing: "0.5px", marginBottom: 4 }}>USDC</div>
                <div className="prism-mono" style={{ fontSize: 16, color: "#E2E0C8", fontWeight: 700 }}>
                  {loadingBalances && !balances ? "..." : balances?.usdc ?? "0.00"}
                </div>
              </div>
              <div style={{ background: "rgba(15, 20, 19, 0.7)", border: "1px solid rgba(226, 224, 200, 0.08)", borderRadius: 12, padding: "0.75rem", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#818C78", fontWeight: 700, letterSpacing: "0.5px", marginBottom: 4 }}>EURC</div>
                <div className="prism-mono" style={{ fontSize: 16, color: "#E2E0C8", fontWeight: 700 }}>
                  {loadingBalances && !balances ? "..." : balances?.eurc ?? "0.00"}
                </div>
              </div>
              <div style={{ background: "rgba(15, 20, 19, 0.7)", border: "1px solid rgba(226, 224, 200, 0.08)", borderRadius: 12, padding: "0.75rem", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#818C78", fontWeight: 700, letterSpacing: "0.5px", marginBottom: 4 }}>cirBTC</div>
                <div className="prism-mono" style={{ fontSize: 16, color: "#E2E0C8", fontWeight: 700 }}>
                  {loadingBalances && !balances ? "..." : balances?.cirbtc ?? "0.000000"}
                </div>
              </div>
            </div>

            <div style={{ background: "rgba(15, 20, 19, 0.7)", border: "1px solid rgba(226, 224, 200, 0.08)", borderRadius: 14, padding: "1rem" }}>
              <div style={{ fontSize: 11, color: "#818C78", fontWeight: 700, letterSpacing: "0.5px", marginBottom: 6 }}>ADDRESS (SAME ON ALL CHAINS)</div>
              <div className="prism-mono" style={{ fontSize: 13, color: "#E2E0C8", wordBreak: "break-all" }}>{wallet.address}</div>
            </div>

            <div style={{ background: "rgba(15, 20, 19, 0.7)", border: "1px solid rgba(226, 224, 200, 0.08)", borderRadius: 14, padding: "1rem" }}>
              <div style={{ fontSize: 11, color: "#818C78", fontWeight: 700, letterSpacing: "0.5px", marginBottom: 8 }}>AVAILABLE ON</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {chainList.map((chain) => (
                  <div key={chain} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
                    <span style={{ color: "#A6B49E" }}>{chain.replace("-", " ")}</span>
                    <span style={{ color: "#E2E0C8", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Check size={13} color="#A6B49E" /> Ready
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p style={{ fontSize: 11.5, color: "#818C78", textAlign: "center", margin: 0 }}>
              Send testnet USDC from the Faucet to this address on any of the chains above — your balance will update automatically.
            </p>

            <a href={`https://testnet.arcscan.app/address/${wallet.address}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center", padding: "0.75rem", borderRadius: 12, border: "1px solid rgba(166, 180, 158, 0.25)", background: "rgba(166, 180, 158, 0.12)", color: "#E2E0C8", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              View on Explorer <ExternalLink size={13} />
            </a>
            <button onClick={forgetWallet}
              style={{ width: "100%", padding: "0.75rem", borderRadius: 12, border: "none", background: "transparent", color: "#818C78", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}
