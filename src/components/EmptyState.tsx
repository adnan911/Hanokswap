import type { ReactNode } from "react";
import { FolderOpen } from "lucide-react";

interface Props {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, subtitle, actionLabel, actionHref, onAction }: Props) {
  return (
    <div style={{ textAlign: "center", padding: "2.5rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(166, 180, 158, 0.12)", border: "1px solid rgba(166, 180, 158, 0.22)", display: "flex", alignItems: "center", justifyContent: "center", color: "#E2E0C8" }}>
        {typeof icon === "string" ? <span style={{ fontSize: 22 }}>{icon}</span> : icon || <FolderOpen size={24} color="#A6B49E" />}
      </div>
      <div style={{ fontSize: 14.5, color: "#E2E0C8", fontWeight: 700 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12.5, color: "#818C78", maxWidth: 360, lineHeight: 1.5 }}>{subtitle}</div>}
      {actionLabel && actionHref && (
        <a href={actionHref} target="_blank" rel="noopener noreferrer"
          style={{ marginTop: 6, padding: "0.55rem 1.25rem", borderRadius: 10, background: "linear-gradient(135deg, #4E635E, #818C78, #A6B49E)", color: "#0F1413", fontSize: 12.5, fontWeight: 800, textDecoration: "none", boxShadow: "0 4px 14px rgba(166,180,158,0.2)" }}>
          {actionLabel}
        </a>
      )}
      {actionLabel && onAction && !actionHref && (
        <button onClick={onAction}
          style={{ marginTop: 6, padding: "0.55rem 1.25rem", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #4E635E, #818C78, #A6B49E)", color: "#0F1413", fontSize: 12.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 14px rgba(166,180,158,0.2)" }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
