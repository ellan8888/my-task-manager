// app/api/bot/kirim-akun/route.ts — dipakai bot (header x-bot-api-key)
//   GET  → antrian Kirim Akun Manual (berisi username, password, kategori, pemilik)
//   POST → lapor { id, status: processing|done|failed, step?, error?, result? }
//          done → web menandai akun sebagai laku (akun baru dibuat di data akun)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { finalizeDelivery, type DeliveryRow } from "@/lib/manualDelivery";

export const dynamic = "force-dynamic";

const isBot = (request: Request) => {
  const key = process.env.BOT_API_KEY;
  return !!key && request.headers.get("x-bot-api-key") === key;
};
const unauthorized = () => NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : (err as { message?: string })?.message || "Terjadi kesalahan";

export async function GET(request: Request) {
  if (!isBot(request)) return unauthorized();
  try {
    // Menunggu, ATAU diproses tapi macet > 10 menit (bot mati di tengah jalan)
    const stuckBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("manual_deliveries")
      .select("*")
      .or(`status.eq.pending,and(status.eq.processing,updated_at.lt.${stuckBefore})`)
      .order("created_at", { ascending: true })
      .limit(3);
    if (error) {
      if (/manual_deliveries/i.test(error.message)) return NextResponse.json({ success: true, data: [] });
      throw error;
    }
    const rows = (data || []) as DeliveryRow[];
    if (!rows.length) return NextResponse.json({ success: true, data: [] });

    // Akun stok: ambil password & kategori terbaru dari accounts_stock
    const stockNames = rows.filter((r) => r.source === "stock").flatMap((r) => r.accounts.map((a) => a.username));
    const stock = new Map<string, { password: string | null; kategori: string | null; added_by: string | null }>();
    if (stockNames.length) {
      const { data: accs } = await supabaseAdmin
        .from("accounts_stock")
        .select("username, password, kategori, added_by")
        .in("username", stockNames);
      (accs || []).forEach((a) => stock.set(a.username, a));
    }

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        order_id: r.order_id,
        detail_url: r.detail_url,
        source: r.source,
        attempts: r.attempts,
        accounts: r.accounts.map((a) => {
          const s = stock.get(a.username);
          return {
            username: a.username,
            password: r.source === "stock" ? s?.password || null : a.password || null,
            kategori: r.source === "stock" ? s?.kategori || a.kategori || null : a.kategori || r.kategori || null,
            owner: (r.source === "stock" ? s?.added_by || a.owner : a.owner || "ellan").toLowerCase(),
            from_stock: r.source === "stock",
          };
        }),
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: errorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isBot(request)) return unauthorized();
  try {
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    const status = body.status as "processing" | "done" | "failed";
    const step = typeof body.step === "string" ? body.step : null;
    if (!Number.isFinite(id) || !["processing", "done", "failed"].includes(status)) {
      return NextResponse.json({ success: false, message: "id dan status wajib" }, { status: 400 });
    }

    const { data: row, error: getErr } = await supabaseAdmin.from("manual_deliveries").select("*").eq("id", id).maybeSingle();
    if (getErr) throw getErr;
    if (!row) return NextResponse.json({ success: false, message: "Tidak ditemukan" }, { status: 404 });
    if (row.status === "cancelled") return NextResponse.json({ success: false, message: "Sudah dibatalkan" }, { status: 409 });

    const now = new Date().toISOString();
    if (status === "processing") {
      await supabaseAdmin
        .from("manual_deliveries")
        .update({
          status: "processing",
          step,
          error: null,
          attempts: step === "baca_order" || !step ? (row.attempts || 0) + 1 : row.attempts || 0,
          updated_at: now,
        })
        .eq("id", id);
      return NextResponse.json({ success: true });
    }
    if (status === "failed") {
      await supabaseAdmin
        .from("manual_deliveries")
        .update({
          status: "failed",
          step,
          error: typeof body.error === "string" ? body.error.slice(0, 500) : "Bot gagal",
          updated_at: now,
        })
        .eq("id", id);
      return NextResponse.json({ success: true });
    }

    // done → tandai akun laku / buat akun baru
    const result = await finalizeDelivery(row as DeliveryRow);
    await supabaseAdmin
      .from("manual_deliveries")
      .update(
        result.ok
          ? {
              status: "done",
              step: null,
              error: null,
              result: typeof body.result === "string" ? body.result.slice(0, 500) : null,
              done_at: now,
              updated_at: now,
            }
          : { status: "finalize_failed", step: "finalisasi", error: result.error, updated_at: now }
      )
      .eq("id", id);
    return NextResponse.json({ success: result.ok, message: result.ok ? "Selesai" : result.error });
  } catch (err) {
    return NextResponse.json({ success: false, message: errorMessage(err) }, { status: 500 });
  }
}
