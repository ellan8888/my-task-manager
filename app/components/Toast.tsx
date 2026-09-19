"use client";

import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
};

type Props = {
  toast: ToastItem;
  onClose: (id: string) => void;
};

export default function Toast({ toast, onClose }: Props) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration ?? 3500;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose(toast.id), 250);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const styles: Record<ToastType, { bg: string; text: string; icon: string; accent: string }> = {
    success: {
      bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30",
      text: "text-emerald-700 dark:text-emerald-300",
      icon: "fa-circle-check",
      accent: "bg-emerald-500",
    },
    error: {
      bg: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30",
      text: "text-red-700 dark:text-red-300",
      icon: "fa-circle-xmark",
      accent: "bg-red-500",
    },
    warning: {
      bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",
      text: "text-amber-700 dark:text-amber-300",
      icon: "fa-triangle-exclamation",
      accent: "bg-amber-500",
    },
    info: {
      bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30",
      text: "text-blue-700 dark:text-blue-300",
      icon: "fa-circle-info",
      accent: "bg-blue-500",
    },
  };

  const s = styles[toast.type];

  return (
    <div
      className={`relative flex items-start gap-3 px-4 py-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl shadow-slate-950/10 dark:shadow-slate-950/50 min-w-80 max-w-md overflow-hidden ${s.bg} ${
        isExiting ? "animate-toast-out" : "animate-toast-in"
      }`}
    >
      {/* Accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.accent}`}></div>

      <i className={`fa-solid ${s.icon} text-lg ${s.text} shrink-0 mt-0.5 ml-1`}></i>

      <p className={`text-sm font-semibold flex-1 leading-relaxed ${s.text}`}>
        {toast.message}
      </p>

      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onClose(toast.id), 250);
        }}
        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition shrink-0 mt-0.5"
        aria-label="Close"
      >
        <i className="fa-solid fa-xmark text-sm"></i>
      </button>
    </div>
  );
}