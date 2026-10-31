"use client";

import { useCallback, useRef, useState } from "react";

export type ConfirmVariant = "danger" | "warning" | "info" | "success";

export type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  variant: ConfirmVariant;
  confirmText: string;
  onConfirm: () => void;
};

export function useConfirm() {
  const [dialog, setDialog] = useState<ConfirmState>({
    open: false,
    title: "",
    message: "",
    variant: "info",
    confirmText: "OK",
    onConfirm: () => {},
  });

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      variant: ConfirmVariant,
      confirmText: string,
      onConfirm: () => void
    ) => {
      setDialog({ open: true, title, message, variant, confirmText, onConfirm });
    },
    []
  );

  const closeConfirm = useCallback(() => {
    setDialog((prev) => ({ ...prev, open: false }));
  }, []);

  return { dialog, showConfirm, closeConfirm };
}

export function ConfirmDialog({
  dialog,
  onClose,
}: {
  dialog: ConfirmState;
  onClose: () => void;
}) {
  if (!dialog.open) return null;

  const iconBox =
    dialog.variant === "danger"
      ? "bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30"
      : dialog.variant === "warning"
      ? "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30"
      : dialog.variant === "success"
      ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
      : "bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-500/30";

  const icon =
    dialog.variant === "danger"
      ? "fa-triangle-exclamation"
      : dialog.variant === "warning"
      ? "fa-circle-exclamation"
      : dialog.variant === "success"
      ? "fa-circle-check"
      : "fa-circle-info";

  const confirmBtn =
    dialog.variant === "danger"
      ? "bg-linear-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-600/30"
      : dialog.variant === "success"
      ? "bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-emerald-600/30"
      : "bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-600/30";

  return (
    <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-md z-60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 md:p-7 shadow-2xl relative animate-in">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${iconBox}`}>
            <i className={`fa-solid text-xl ${icon}`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">{dialog.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed whitespace-pre-line">
              {dialog.message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition"
          >
            Batal
          </button>
          <button
            onClick={dialog.onConfirm}
            className={`px-6 py-2.5 rounded-xl text-xs font-extrabold text-white shadow-lg transition ${confirmBtn}`}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VERSI ASYNC — pengganti confirm() bawaan browser
//   const { confirm, confirmDialog } = useConfirmAsync();
//   if (!(await confirm({ title: "Hapus?", message: "..." }))) return;
//   ...render {confirmDialog} di JSX
// ══════════════════════════════════════════════════════════════

export type ConfirmOptions = {
  title: string;
  message?: string;
  variant?: ConfirmVariant;
  confirmText?: string;
};

export function useConfirmAsync() {
  const { dialog, showConfirm, closeConfirm } = useConfirm();
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback(
    ({ title, message = "", variant = "warning", confirmText = "Ya, lanjutkan" }: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current?.(false); // dialog sebelumnya dianggap batal
        resolverRef.current = resolve;
        showConfirm(title, message, variant, confirmText, () => {
          resolverRef.current = null;
          closeConfirm();
          resolve(true);
        });
      }),
    [showConfirm, closeConfirm]
  );

  const handleClose = useCallback(() => {
    resolverRef.current?.(false);
    resolverRef.current = null;
    closeConfirm();
  }, [closeConfirm]);

  const confirmDialog = <ConfirmDialog dialog={dialog} onClose={handleClose} />;

  return { confirm, confirmDialog };
}
