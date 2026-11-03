// app/api/bot/ganti-akun/route.ts — dipakai bot (header x-bot-api-key)
//   GET  → antrian ganti akun yang menunggu (berisi password akun pengganti)
//   POST → bot lapor progres / hasil. Kalau selesai, web menyelesaikan data:
//          akun pengganti → laku, pendapatan & fee pindah, akun bermasalah dihapus permanen.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { finalizeReplacement, type ReplacementRow } from "@/lib/replacements";

export const dynamic = "force-dynamic";

const isBot = (request: Request) => {
  const key = process.env.BOT_API_KEY;
  return !!key && request.headers.get("x-bot-api-key") === key;
};

const unauthorized = () => NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

export async function GET(request: Request) {
  if (!isBot(request)) return unauthorized();

  try {
    // Menunggu, ATAU "diproses" tapi macet > 10 menit (misal bot mati di tengah jalan)
    const stuckBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("account_replacements")
      .select("*")
      .or(`status.eq.pending,and(status.eq.processing,updated_at.lt.${stuckBefore})`)
      .order("created_at", { ascending: true })
      .limit(3);
    if (error) throw error;

    const rows = (data || []) as ReplacementRow[];
    if (!rows.length) return NextResponse.json({ success: true, data: [] });

    const { data: accs } = await supabaseAdmin
      .from("accounts_stock")
      .select("username, password")
      .in("username", rows.map((r) => r.new_username));
    const pw = new Map((accs || []).map((a) => [a.username, a.password]));

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        order_id: r.order_id,
        detail_url: r.detail_url,
        kategori: r.kategori,
        old_username: r.old_username,
        new_username: r.new_username,
        new_password: pw.get(r.new_username) || null,
        attempts: r.attempts,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : (err as { message?: string })?.message || "Terjadi kesalahan";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isBot(request)) return unauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    const status = body.status as "processing" | "done" | "failed";
    const step = typeof body.step === "string" ? body.step : null;
    const error = typeof body.error === "string" ? body.error.slice(0, 500) : null;
    if (!Number.isFinite(id) || !["processing", "done", "failed"].includes(status)) {
      return NextResponse.json({ success: false, message: "id dan status wajib" }, { status: 400 });
    }

    const { data: rep, error: getErr } = await supabaseAdmin
      .from("account_replacements")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!rep) return NextResponse.json({ success: false, message: "Tidak ditemukan" }, { status: 404 });

    const now = new Date().toISOString();

    if (status === "processing") {
      await supabaseAdmin
        .from("account_replacements")
        .update({
          status: "processing",
          step,
          error: null,
          // Hitung percobaan sekali per putaran (di langkah pertama)
          attempts: step === "hapus_itemku" || !step ? (rep.attempts || 0) + 1 : rep.attempts || 0,
          updated_at: now,
        })
        .eq("id", id);
      return NextResponse.json({ success: true });
    }

    if (status === "failed") {
      await supabaseAdmin
        .from("account_replacements")
        .update({ status: "failed", step, error: error || "Bot gagal", updated_at: now })
        .eq("id", id);
      return NextResponse.json({ success: true });
    }

    // done → selesaikan data di web
    const result = await finalizeReplacement(rep as ReplacementRow);
    await supabaseAdmin
      .from("account_replacements")
      .update(
        result.ok
          ? { status: "done", step: null, error: null, note: result.note ?? null, done_at: now, updated_at: now }
          : { status: "finalize_failed", step: "finalisasi", error: result.error, updated_at: now }
      )
      .eq("id", id);

    return NextResponse.json({ success: result.ok, message: result.ok ? "Selesai" : result.error });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : (err as { message?: string })?.message || "Terjadi kesalahan";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
