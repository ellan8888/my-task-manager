// app/api/accounts/stock/bulk-move/route.ts — Migrasi Massal (khusus owner)
//
//   GET    ?from=<kategori>   → pratinjau: akun yang ikut per pemilik + yang dilewati & alasannya
//          (tanpa ?from)      → antrean migrasi yang sedang berjalan
//   POST   { fromKategori, targetKategori } → masukkan akun yang AMAN ke antrean migrasi
//   DELETE { targetKategori? }             → batalkan migrasi yang belum diproses bot
//
// Akun yang ikut HANYA yang sedang dijual / menunggu dipajang di Itemku.
// Akun laku, Stok Pribadi, yang sedang dihapus, dan yang sedang dipakai Ganti Akun /
// Kirim Akun Manual TIDAK ikut. Pemilik akun (added_by) TIDAK berubah.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, isSuperadmin } from "@/lib/auth";
import { ACTIVE_STATUSES, isEllan } from "@/lib/replacements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ELIGIBLE_STATUSES = ["listed", "queued_for_sale"];

type Row = {
  id: number;
  username: string;
  kategori: string | null;
  added_by: string | null;
  status: string | null;
  logged_out: boolean | null;
  deleted: boolean | null;
  pending_move_to?: string | null;
  delete_status?: string | null;
};

const forbidden = () => NextResponse.json({ success: false, message: "Khusus owner" }, { status: 403 });
const canMigrate = (req: NextRequest) => {
  const s = getSession(req);
  return isEllan(s) || isSuperadmin(s);
};
const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : (err as { message?: string })?.message || "Terjadi kesalahan";

/** Akun yang sedang dipakai Ganti Akun / Kirim Akun Manual */
async function busyUsernames() {
  const set = new Set<string>();
  const { data: rep } = await supabaseAdmin
    .from("account_replacements")
    .select("old_username, new_username")
    .in("status", ACTIVE_STATUSES);
  (rep || []).forEach((r) => {
    if (r.new_username) set.add(String(r.new_username).toLowerCase());
    if (r.old_username) set.add(String(r.old_username).toLowerCase());
  });
  const { data: md, error } = await supabaseAdmin
    .from("manual_deliveries")
    .select("accounts")
    .in("status", ["pending", "processing", "failed", "finalize_failed"]);
  if (!error) {
    (md || []).forEach((r) =>
      ((r.accounts as { username: string }[]) || []).forEach((a) => set.add(a.username.toLowerCase()))
    );
  }
  return set;
}

/** Pisahkan akun kategori asal: yang ikut migrasi vs yang dilewati (+ alasan) */
async function classify(fromKategori: string) {
  const { data, error } = await supabaseAdmin
    .from("accounts_stock")
    .select("id, username, kategori, added_by, status, logged_out, deleted")
    .ilike("kategori", fromKategori.trim());
  if (error) throw error;

  const busy = await busyUsernames();
  const eligible: Row[] = [];
  const skipped = { sold: 0, personal: 0, deleting: 0, busy: 0, other: 0 };

  for (const a of (data || []) as Row[]) {
    if (a.deleted) skipped.deleting++;
    else if (a.logged_out) skipped.sold++;
    else if (a.status === "personal") skipped.personal++;
    else if (!ELIGIBLE_STATUSES.includes(a.status || "")) skipped.other++;
    else if (busy.has(a.username.toLowerCase())) skipped.busy++;
    else eligible.push(a);
  }
  return { eligible, skipped };
}

function groupByOwner(rows: Row[]) {
  const map = new Map<string, { owner: string; total: number; listed: number; queued: number }>();
  for (const r of rows) {
    const owner = (r.added_by || "-").toLowerCase();
    const g = map.get(owner) || { owner, total: 0, listed: 0, queued: 0 };
    g.total++;
    if (r.status === "listed") g.listed++;
    else g.queued++;
    map.set(owner, g);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export async function GET(req: NextRequest) {
  if (!canMigrate(req)) return forbidden();
  try {
    const from = new URL(req.url).searchParams.get("from");

    if (from) {
      const { eligible, skipped } = await classify(from);
      return NextResponse.json({
        success: true,
        from,
        total: eligible.length,
        owners: groupByOwner(eligible),
        skipped,
        sample: eligible.slice(0, 50).map((a) => ({ username: a.username, owner: a.added_by, status: a.status })),
      });
    }

    // Antrean migrasi yang sedang berjalan
    const { data, error } = await supabaseAdmin
      .from("accounts_stock")
      .select("username, kategori, added_by, pending_move_to, delete_status, delete_attempts, delete_last_error")
      .not("pending_move_to", "is", null);
    if (error) throw error;
    const queue = new Map<string, { from: string; to: string; waiting: number; failed: number; stuck: number; last_error: string | null }>();
    for (const r of data || []) {
      const key = `${r.kategori}→${r.pending_move_to}`;
      const g = queue.get(key) || { from: r.kategori || "-", to: r.pending_move_to, waiting: 0, failed: 0, stuck: 0, last_error: null };
      if ((r.delete_attempts || 0) >= 5) g.stuck++;
      else if (r.delete_status === "failed") g.failed++;
      else g.waiting++;
      if (r.delete_last_error) g.last_error = r.delete_last_error;
      queue.set(key, g);
    }
    return NextResponse.json({ success: true, queue: [...queue.values()] });
  } catch (err) {
    return NextResponse.json({ success: false, message: errorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!canMigrate(req)) return forbidden();
  try {
    const { fromKategori, targetKategori } = await req.json();

    if (!fromKategori || !targetKategori) {
      return NextResponse.json({ success: false, message: "Kategori asal & tujuan wajib diisi" }, { status: 400 });
    }
    if (String(fromKategori).toLowerCase().trim() === String(targetKategori).toLowerCase().trim()) {
      return NextResponse.json({ success: false, message: "Kategori asal dan tujuan tidak boleh sama" }, { status: 400 });
    }

    const { data: target } = await supabaseAdmin
      .from("kategori_links")
      .select("kategori")
      .ilike("kategori", String(targetKategori).trim())
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ success: false, message: `Kategori tujuan "${targetKategori}" tidak ditemukan` }, { status: 400 });
    }

    const { eligible, skipped } = await classify(fromKategori);
    if (!eligible.length) {
      return NextResponse.json(
        { success: false, message: `Tidak ada akun yang sedang dijual di kategori "${fromKategori}"` },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const { error: markErr } = await supabaseAdmin
      .from("accounts_stock")
      .update({
        deleted: true,
        deleted_at: now,
        delete_status: "pending",
        delete_attempts: 0,
        delete_last_error: null,
        delete_requested_at: now,
        pending_move_to: target.kategori,
        pending_move_added_by: null, // pemilik akun TIDAK berubah
      })
      .in("id", eligible.map((a) => a.id))
      // jaga-jaga: kalau status berubah di antara cek dan update, jangan ikut
      .eq("deleted", false)
      .eq("logged_out", false)
      .in("status", ELIGIBLE_STATUSES);
    if (markErr) return NextResponse.json({ success: false, message: markErr.message }, { status: 500 });

    const skippedTotal = Object.values(skipped).reduce((a, b) => a + b, 0);
    return NextResponse.json({
      success: true,
      message:
        `${eligible.length} akun masuk antrean migrasi ke "${target.kategori}".` +
        (skippedTotal ? ` ${skippedTotal} akun dilewati (laku / Stok Pribadi / sedang diproses).` : ""),
      total: eligible.length,
      skipped,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: errorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!canMigrate(req)) return forbidden();
  try {
    const body = await req.json().catch(() => ({}));
    let query = supabaseAdmin
      .from("accounts_stock")
      .update({
        deleted: false,
        deleted_at: null,
        delete_status: null,
        delete_attempts: 0,
        delete_last_error: null,
        delete_requested_at: null,
        pending_move_to: null,
        pending_move_added_by: null,
      })
      .not("pending_move_to", "is", null)
      .in("delete_status", ["pending", "failed"]);
    if (body?.targetKategori) query = query.eq("pending_move_to", String(body.targetKategori));
    if (body?.fromKategori) query = query.ilike("kategori", String(body.fromKategori));

    const { data, error } = await query.select("username");
    if (error) throw error;
    return NextResponse.json({
      success: true,
      cancelled: (data || []).length,
      message: `${(data || []).length} akun dibatalkan dari antrean migrasi`,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: errorMessage(err) }, { status: 500 });
  }
}
