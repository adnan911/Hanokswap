import { useEffect, useState, type ReactNode } from "react";
import { subscribeToasts, type ToastMessage } from "../toast";
import { Check, X, Info } from "lucide-react";

const TYPE_STYLE: Record<string, { bg: string; border: string; color: string; icon: ReactNode }> = {
  success: { bg: "rgba(78,99,94,0.35)", border: "rgba(166,180,158,0.45)", color: "#A6B49E", icon: <Check size={14} color="#A6B49E" /> },
  error: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.35)", color: "#EF4444", icon: <X size={14} color="#EF4444" /> },
  info: { bg: "rgba(166,180,158,0.2)", border: "rgba(226,224,200,0.35)", color: "#E2E0C8", icon: <Info size={14} color="#E2E0C8" /> },
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return subscribeToasts(setToasts);
  }, []);

  return (
    <div style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
      {toasts.map((t) => {
        const style = TYPE_STYLE[t.type] ?? TYPE_STYLE.success;
        return (
          <div key={t.id}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              background: "rgba(18, 25, 23, 0.95)", backdropFilter: "blur(16px)",
              border: `1px solid ${style.border}`, borderRadius: 16,
              padding: "0.85rem 1.25rem", minWidth: 240, maxWidth: 360,
              boxShadow: "0 12px 36px rgba(0, 0, 0, 0.75), 0 0 20px rgba(166, 180, 158, 0.1)",
              animation: "prism-toast-in 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
            }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: style.bg, color: style.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0, border: `1px solid ${style.border}` }}>
              {style.icon}
            </div>
            <span style={{ fontSize: 13.5, color: "#E2E0C8", fontWeight: 600 }}>{t.message}</span>
          </div>
        );
      })}
      <style>{`
        @keyframes prism-toast-in {
          from { opacity: 0; transform: translateX(40px) scale(0.95); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
