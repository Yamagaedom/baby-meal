"use client";

import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

export type ToastTone = "info" | "success" | "warning" | "error";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const TONE_STYLES: Record<ToastTone, { cls: string }> = {
  info: {
    cls: "border-[var(--color-border-strong)] bg-[var(--color-text)] text-white",
  },
  success: {
    cls: "border-[var(--color-success-border)] bg-[var(--color-secondary-text)] text-white",
  },
  warning: {
    cls: "border-[var(--color-warning-border)] bg-[var(--color-warning-text)] text-white",
  },
  error: {
    cls: "border-[var(--color-danger-border)] bg-[var(--color-danger-text)] text-white",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed right-4 bottom-20 left-4 z-50 mx-auto flex max-w-md flex-col gap-2 lg:bottom-6"
      >
        {toasts.map((t) => {
          const style = TONE_STYLES[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg ${style.cls}`}
            >
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
