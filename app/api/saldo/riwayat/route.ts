// app/api/saldo/riwayat/route.ts — Riwayat Saldo (buku kas, SQL 009)
//
//   GET  ?user=rizki&from=YYYY-MM-DD&to=YYYY-MM-DD&type=all|in|out&q=&offset=0&limit=50
//        Staff  : selalu saldo miliknya sendiri (param user diabaikan)
//        Ellan  : boleh pilih user mana pun
//        from/to kosong = semua waktu
//
//   POST { username, amount, reason }   — penyesuaian manual, khusus Ellan
//        amount + = tambah saldo, − = kurangi saldo
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { canSeeFee, getSession } from "@/lib/auth";
import { isEllan } from "@/lib/replacements";
import { TEAM, fetchAll } from "@/lib/teamIncome";
import { isLedgerMissing, type LedgerRow } from "@/lib/ledger";

export const dynamic = "force-dynamic";

const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const wibStartMs = (d: string) => new Date(`${d}T00:00:00+07:00`).getTime();
const DAY = 86_400_000;

type Enriched = LedgerRow & {
  balance_before: number;
  balance_after: number;
  fee: { gross: number; fee: number; percent: number } | null;
  withdrawal: {
    status: string;
    bank_name: string | null;
    account_number: string | null;
    reject_reason: string | null;
    payment_proof_url: string | null;
  } | null;
};

export async function GET(req: Request) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ success: false, message: "Belum login" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const owner = isEllan(session);
  const showFee = canSeeFee(session);
  const target = (owner ? sp.get("user") || session.username : session.username).toLowerCase().trim();

  const from = sp.get("from");
  const to = sp.get("to");
  const type = sp.get("type") === "in" ? "in" : sp.get("type") === "out" ? "out" : "all";
  const q = (sp.get("q") || "").trim().toLowerCase();
  const offset = Math.max(0, parseInt(sp.get("offset") || "0", 10) || 0);
  const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") || "50", 10) || 50));

  // ── Semua baris user ini, urut lama → baru ─────────────────
  let rows: LedgerRow[];
  try {
    rows = await fetchAll<LedgerRow>((a, b) =>
      supabaseAdmin
        .from("balance_ledger")
        .select("id, username, amount, kind, title, detail, order_id, ref_table, ref_id, created_by, created_at")
        .eq("username", target)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(a, b)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isLedgerMissing({ message })) {
      return NextResponse.json({ success: true, ready: false, user: target, members: owner ? TEAM : [target] });
    }
    return NextResponse.json({ success: false, message }, { status: 500 });
  }

  // ── Saldo berjalan ─────────────────────────────────────────
  let running = 0;
  const withBalance = rows.map((r) => {
    const amount = Number(r.amount) || 0;
    const before = running;
    running += amount;
    return { ...r, amount, balance_before: before, balance_after: running };
  });
  const currentBalance = running;

  // ── Periode ────────────────────────────────────────────────
  const fromMs = isDate(from) ? wibStartMs(from) : -Infinity;
  const toMs = isDate(to) ? wibStartMs(to) + DAY : Infinity;
  const inRange = withBalance.filter((r) => {
    const t = new Date(r.created_at).getTime();
    return t >= fromMs && t < toMs;
  });
  const before = withBalance.filter((r) => new Date(r.created_at).getTime() < fromMs);
  const opening = before.length ? before[before.length - 1].balance_after : 0;
  const totalIn = inRange.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const totalOut = inRange.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);
  const closing = opening + totalIn - totalOut;

  // ── Filter tampilan ────────────────────────────────────────
  const filtered = inRange
    .filter((r) => (type === "in" ? r.amount > 0 : type === "out" ? r.amount < 0 : true))
    .filter(
      (r) =>
        !q ||
        r.title.toLowerCase().includes(q) ||
        (r.detail || "").toLowerCase().includes(q) ||
        (r.order_id || "").toLowerCase().includes(q)
    )
    .reverse(); // terbaru di atas

  const page = filtered.slice(offset, offset + limit);

  // ── Lengkapi: potongan fee & status penarikan ──────────────
  // Potongan fee hanya untuk Ellan — staff tidak boleh melihat fee yang dipotong
  const incomeIds = showFee
    ? page.filter((r) => r.ref_table === "income_log" && r.kind.startsWith("income_")).map((r) => r.ref_id!)
    : [];
  const wdIds = page.filter((r) => r.ref_table === "withdrawals").map((r) => r.ref_id!);

  const [feeRes, wdRes] = await Promise.all([
    incomeIds.length
      ? supabaseAdmin.from("income_fee_log").select("income_log_id, gross_amount, fee_amount, fee_percent").in("income_log_id", incomeIds)
      : Promise.resolve({ data: [] as { income_log_id: number; gross_amount: number; fee_amount: number; fee_percent: number }[] }),
    wdIds.length
      ? supabaseAdmin
          .from("withdrawals")
          .select("id, status, bank_name, account_number, reject_reason, payment_proof_url")
          .in("id", wdIds)
      : Promise.resolve({ data: [] as { id: number; status: string; bank_name: string | null; account_number: string | null; reject_reason: string | null; payment_proof_url: string | null }[] }),
  ]);

  const feeMap = new Map((feeRes.data || []).map((f) => [String(f.income_log_id), f]));
  const wdMap = new Map((wdRes.data || []).map((w) => [String(w.id), w]));

  const items: Enriched[] = page.map((r) => {
    const f = r.ref_id ? feeMap.get(r.ref_id) : undefined;
    const w = r.ref_table === "withdrawals" && r.ref_id ? wdMap.get(r.ref_id) : undefined;
    return {
      ...r,
      fee: showFee && f && Number(f.fee_amount) > 0 ? { gross: Number(f.gross_amount), fee: Number(f.fee_amount), percent: Number(f.fee_percent) } : null,
      withdrawal: w
        ? {
            status: w.status,
            bank_name: w.bank_name,
            account_number: w.account_number,
            reject_reason: w.reject_reason,
            payment_proof_url: w.payment_proof_url,
          }
        : null,
    };
  });

  return NextResponse.json({
    success: true,
    ready: true,
    user: target,
    members: owner ? TEAM : [target],
    balance: currentBalance,
    summary: { opening, total_in: totalIn, total_out: totalOut, closing, count: inRange.length },
    total: filtered.length,
    offset,
    items,
  });
}

export async function POST(req: Request) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ success: false, message: "Belum login" }, { status: 401 });
  if (!isEllan(session)) {
    return NextResponse.json({ success: false, message: "Penyesuaian saldo khusus Ellan" }, { status: 403 });
  }

  let body: { username?: string; amount?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Data tidak valid" }, { status: 400 });
  }

  const username = String(body.username || "").toLowerCase().trim();
  const amount = Math.round(Number(body.amount));
  const reason = String(body.reason || "").trim().slice(0, 300);

  if (!TEAM.includes(username)) {
    return NextResponse.json({ success: false, message: "Anggota tidak dikenal" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100_000_000) {
    return NextResponse.json({ success: false, message: "Nominal tidak valid" }, { status: 400 });
  }
  if (reason.length < 3) {
    return NextResponse.json({ success: false, message: "Alasan wajib diisi" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("balance_ledger")
    .insert({
      username,
      amount,
      kind: "adjustment",
      title: amount > 0 ? "Penyesuaian saldo (tambah)" : "Penyesuaian saldo (kurang)",
      detail: reason,
      created_by: session.username.toLowerCase(),
    })
    .select("id")
    .single();

  if (error) {
    if (isLedgerMissing(error)) {
      return NextResponse.json({ success: false, message: "Jalankan SQL 009 dulu di Supabase" }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}
