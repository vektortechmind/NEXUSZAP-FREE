import React, { useRef } from "react";
import { AlertCircle, Check, Info, AlertTriangle } from "lucide-react";
import { useTheme } from "./useTheme";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}
interface ToastContextType {
  toasts: Toast[];
  addToast: (messageParam: string, typeParam?: ToastType, durationParam?: number) => void;
  removeToast: (idParam: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const toastIdSeq = useRef(0);

  const addToast = (message: string, type: ToastType = "info", duration = 3000) => {
    const id = `toast-${++toastIdSeq.current}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);

    if (duration) {
      setTimeout(() => removeToast(id), duration);
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const getIcon = (type: ToastType) => {
    const iconProps = { className: "w-5 h-5" };
    switch (type) {
      case "success":
        return <Check {...iconProps} />;
      case "error":
        return <AlertCircle {...iconProps} />;
      case "warning":
        return <AlertTriangle {...iconProps} />;
      default:
        return <Info {...iconProps} />;
    }
  };

  const getColors = (type: ToastType) => {
    const isDark = theme === "dark";
    const colors = {
      success: {
        bg: isDark ? "bg-green-500/10" : "bg-green-50",
        border: isDark ? "border-green-500/30" : "border-green-200",
        text: isDark ? "text-green-400" : "text-green-700",
        icon: isDark ? "text-green-400" : "text-green-600",
      },
      error: {
        bg: isDark ? "bg-red-500/10" : "bg-red-50",
        border: isDark ? "border-red-500/30" : "border-red-200",
        text: isDark ? "text-red-400" : "text-red-700",
        icon: isDark ? "text-red-400" : "text-red-600",
      },
      warning: {
        bg: isDark ? "bg-yellow-500/10" : "bg-yellow-50",
        border: isDark ? "border-yellow-500/30" : "border-yellow-200",
        text: isDark ? "text-yellow-400" : "text-yellow-700",
        icon: isDark ? "text-yellow-400" : "text-yellow-600",
      },
      info: {
        bg: isDark ? "bg-blue-500/10" : "bg-blue-50",
        border: isDark ? "border-blue-500/30" : "border-blue-200",
        text: isDark ? "text-blue-400" : "text-blue-700",
        icon: isDark ? "text-blue-400" : "text-blue-600",
      },
    };
    return colors[type];
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 space-y-3">
        {toasts.map((toast) => {
          const colors = getColors(toast.type);
          return (
            <div
              key={toast.id}
              className={`${colors.bg} ${colors.border} border rounded-2xl backdrop-blur-xl shadow-[0_20px_40px_-24px_rgba(15,23,42,0.6)] p-4 flex items-center gap-3 min-w-[320px] animate-in slide-in-from-right-5`}
              onClick={() => removeToast(toast.id)}
            >
              <div className={colors.icon}>{getIcon(toast.type)}</div>
              <p className={`${colors.text} font-medium flex-1`}>{toast.message}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeToast(toast.id);
                }}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};
