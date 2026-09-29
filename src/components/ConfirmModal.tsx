import { useDialog } from "../useDialog";

interface ConfirmRow {
  label: string;
  value: string;
  highlight?: boolean; // e.g. for the amount or a risk warning
}

interface Props {
  title: string;
  rows: ConfirmRow[];
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  warning?: string; // optional extra warning line shown in red
}

export default function ConfirmModal({ title, rows, confirmLabel = "Confirm", onConfirm, onCancel, warning }: Props) {
  const dialogRef = useDialog(onCancel);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8, 12, 11, 0.85)", backdropFilter: "blur(14px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={onCancel}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} style={{ maxHeight: "calc(100dvh - 2rem)", overflowY: "auto", background: "linear-gradient(145deg, rgba(20, 28, 25, 0.96), rgba(12, 17, 15, 0.98))", border: "1px solid rgba(226, 224, 200, 0.15)", borderRadius: 24, padding: "1.75rem", width: "100%", maxWidth: 400, boxShadow: "0 24px 60px rgba(0,0,0,0.85), 0 0 30px rgba(166, 180, 158, 0.12)", color: "#E2E0C8" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="prism-display" style={{ fontSize: 18, fontWeight: 800, color: "#E2E0C8", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "#818C78", marginBottom: 18 }}>Review parameters before signing in your wallet.</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: warning ? 14 : 20 }}>
          {rows.map((row, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, paddingBottom: 8, borderBottom: i < rows.length - 1 ? "1px solid rgba(226,224,200,0.06)" : "none" }}>
              <span style={{ flexShrink: 0, fontSize: 12.5, color: "#818C78" }}>{row.label}</span>
              <span style={{ minWidth: 0, overflowWrap: "anywhere", textAlign: "right", fontSize: row.highlight ? 15 : 13, fontWeight: row.highlight ? 800 : 600, color: row.highlight ? "#A6B49E" : "#E2E0C8", fontFamily: "'JetBrains Mono', monospace" }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {warning && (
          <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 12, padding: "0.75rem 0.9rem", marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#EF4444", margin: 0, lineHeight: 1.4 }}>{warning}</p>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel}
            style={{ padding: "0.75rem 1.25rem", borderRadius: 12, border: "1px solid rgba(226,224,200,0.12)", background: "rgba(226,224,200,0.04)", color: "#818C78", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            style={{ flex: 1, padding: "0.75rem", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #4E635E 0%, #818C78 50%, #A6B49E 100%)", color: "#0F1413", fontSize: 13.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 18px rgba(166,180,158,0.2)" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
