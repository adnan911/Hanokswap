import { useState } from "react";
import { showToast } from "../toast";

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [lastError, setLastError] = useState("");

  async function submit() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, page: window.location.pathname }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "(no body)");
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
      showToast("Thanks! Your feedback was sent.", "success");
      setMessage("");
      setLastError("");
      setOpen(false);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setLastError(detail);
      showToast(`Feedback failed: ${detail}`, "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ position: "fixed", bottom: 24, left: 24, zIndex: 997, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
      {open && (
        <div style={{ background: "rgba(20, 28, 25, 0.98)", border: "1px solid rgba(226, 224, 200, 0.18)", borderRadius: 16, padding: "1rem", width: 280, boxShadow: "0 20px 48px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", gap: 8, backdropFilter: "blur(20px)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E0C8" }}>Send Feedback</div>
          <p style={{ fontSize: 11.5, color: "#818C78", margin: 0, lineHeight: 1.4 }}>
            Spotted something off, or have an idea? This goes straight to the team.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's on your mind?"
            rows={4}
            style={{ resize: "none", border: "1px solid rgba(226, 224, 200, 0.12)", background: "rgba(16, 23, 20, 0.6)", borderRadius: 10, padding: "0.6rem", fontSize: 12.5, color: "#E2E0C8", outline: "none", fontFamily: "inherit" }}
          />
          {lastError && (
            <div style={{ fontSize: 10.5, color: "#FCA5A5", background: "rgba(239,68,68,0.12)", borderRadius: 8, padding: "0.5rem", wordBreak: "break-word" }}>
              {lastError}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={submit} disabled={sending || !message.trim()}
              style={{ flex: 1, padding: "0.55rem", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #4E635E, #818C78)", color: "#E2E0C8", fontSize: 12, fontWeight: 700, cursor: sending || !message.trim() ? "not-allowed" : "pointer", opacity: sending || !message.trim() ? 0.5 : 1 }}>
              {sending ? "Sending..." : "Send"}
            </button>
            <button onClick={() => setOpen(false)}
              style={{ padding: "0.55rem 0.9rem", borderRadius: 10, border: "1px solid rgba(226, 224, 200, 0.12)", background: "rgba(166, 180, 158, 0.1)", color: "#818C78", fontSize: 12, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setOpen(!open)} title="Send feedback"
          style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(226, 224, 200, 0.15)", background: "rgba(20, 28, 25, 0.85)", color: "#E2E0C8", fontSize: 18, cursor: "pointer", boxShadow: "0 10px 25px rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(12px)" }}>
          💬
        </button>
        <a href="https://x.com" target="_blank" rel="noopener noreferrer" title="Follow PrismSwap on X"
          style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(226, 224, 200, 0.15)", background: "rgba(20, 28, 25, 0.85)", color: "#E2E0C8", fontSize: 16, cursor: "pointer", boxShadow: "0 10px 25px rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", backdropFilter: "blur(12px)" }}>
          𝕏
        </a>
      </div>
    </div>
  );
}
