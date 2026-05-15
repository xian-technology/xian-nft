import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useToasts, type Toast } from "../hooks/useToasts";

const KIND_ICON = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
} as const;

const KIND_STYLE: Record<Toast["kind"], string> = {
  success: "alert-success",
  error: "alert-error",
  warning: "alert-warning",
  info: "alert-info"
};

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  if (toasts.length === 0) return null;

  return (
    <div className="toast toast-end toast-bottom z-50 max-w-sm">
      {toasts.map((t) => {
        const Icon = KIND_ICON[t.kind];
        return (
          <div key={t.id} className={`alert ${KIND_STYLE[t.kind]} shadow-lg`}>
            <Icon size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-semibold">{t.title}</div>
              {t.message && <div className="text-xs opacity-80 mt-0.5 break-words">{t.message}</div>}
            </div>
            <button
              className="btn btn-ghost btn-xs btn-circle"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
