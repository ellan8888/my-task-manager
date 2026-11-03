// lib/ledger.ts — buku kas saldo (tabel balance_ledger, SQL 009). Server only.
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type LedgerKind =
  | "income_akun"
  | "income_joki"
  | "moved_in"
  | "moved_out"
  | "income_fix"
  | "income_removed"
  | "withdraw"
  | "code_purchase"
  | "refund"
  | "adjustment";

export type LedgerRow = {
  id: number;
  username: string;
  amount: number;
  kind: LedgerKind;
  title: string;
  detail: string | null;
  order_id: string | null;
  ref_table: string | null;
  ref_id: string | null;
  created_by: string | null;
  created_at: string;
};

/** Error Supabase karena tabel / fungsi ledger belum dibuat (SQL 009 belum dijalankan) */
export function isLedgerMissing(err: { code?: string; message?: string } | null | undefined) {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  return (
    err.code === "42P01" ||
    err.code === "42883" ||
    err.code === "PGRST202" ||
    err.code === "PGRST205" ||
    msg.includes("balance_ledger") ||
    msg.includes("ledger_balance")
  );
}

/**
 * Saldo user menurut buku kas.
 * null = ledger belum tersedia → pemanggil pakai hitungan lama.
 */
export async function getLedgerBalance(username: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin.rpc("ledger_balance", { p_username: username.toLowerCase().trim() });
  if (error) {
    if (!isLedgerMissing(error)) console.error("[ledger] gagal hitung saldo:", error.message);
    return null;
  }
  return Number(data ?? 0);
}

/** Saldo cara lama: pendapatan − penarikan (pending/approved, termasuk beli code) */
export async function getLegacyBalance(username: string): Promise<number> {
  const [{ data: income }, { data: wd }] = await Promise.all([
    supabaseAdmin.from("income_log").select("amount").eq("joki_name", username),
    supabaseAdmin.from("withdrawals").select("amount").eq("joki_name", username).in("status", ["approved", "pending"]),
  ]);
  const totalIncome = (income || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalWd = (wd || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  return totalIncome - totalWd;
}

/** Saldo yang dipakai untuk validasi tarik / beli code */
export async function getBalance(username: string): Promise<number> {
  const ledger = await getLedgerBalance(username);
  return ledger ?? (await getLegacyBalance(username));
}
