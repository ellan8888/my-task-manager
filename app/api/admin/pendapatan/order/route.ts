// app/api/admin/pendapatan/order/route.ts — khusus Ellan
//   GET  ?order_id=  → apakah order sudah masuk income, dan posisinya sekarang
//   POST { order_id, action } → proses ulang:
//        catat_joki  : order joki sudah selesai tapi belum ada income → dicatat langsung oleh web
//        retry_joki  : order joki gagal di bot → bot mengulang penyelesaian (sama seperti Order Gagal)
//        catat_akun  : order akun → bot membaca rincian order & mencatat income SAJA (tanpa chat)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { isEllan, orderDetailUrl } from "@/lib/replacements";
import { normalizeOrderInput, recordIncome } from "@/lib/teamIncome";

export const dynamic = "force-dynamic";

const MAX_MANUAL_RETRY = 5;

const JOKI_FIELDS =
  "order_id, product, joki_name, roblox_username, buyer_name, queue_status, completed, completed_by_bot, completed_at, " +
  "bot_process_failed, bot_failed_reason, total_income, order_type, manual_retry_count, bot_retry_requested, detail_url";

type JokiRow = {
  order_id: string;
  product: string | null;
  joki_name: string | null;
  roblox_username: string | null;
  buyer_name: string | null;
  queue_status: string | null;
  completed: boolean | null;
  completed_by_bot: boolean | null;
  completed_at: string | null;
  bot_process_failed: boolean | null;
  bot_failed_reason: string | null;
  total_income: number | null;
  order_type: string | null;
  manual_retry_count: number | null;
  bot_retry_requested: boolean | null;
  detail_url: string | null;
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message || "Terjadi kesalahan");

async function loadJoki(orderId: string): Promise<JokiRow | null> {
  const { data, error } = await supabaseAdmin.from("joki_orders").select(JOKI_FIELDS).eq("order_id", orderId).maybeSingle();
  if (error && !/column/i.test(error.message)) throw error;
  if (error) {
    // Kolom opsional belum ada di DB lama → ambil yang pasti ada
    const { data: d2 } = await supabaseAdmin.from("joki_orders").select("*").eq("order_id", orderId).maybeSingle();
    return (d2 as JokiRow) || null;
  }
  return (data as unknown as JokiRow) || null;
}

function jokiDone(j: JokiRow) {
  return j.completed_by_bot === true || j.queue_status === "completed" || j.completed === true;
}

export async function GET(request: Request) {
  if (!isEllan(getSession(request))) {
    return NextResponse.json({ success: false, message: "Khusus Ellan" }, { status: 403 });
  }

  const raw = new URL(request.url).searchParams.get("order_id") || "";
  const orderId = normalizeOrderInput(raw);
  if (!/^OD\d{6,}$/.test(orderId)) {
    return NextResponse.json({ success: false, message: "Masukkan nomor order yang valid (OD... atau angkanya saja)" }, { status: 400 });
  }

  try {
    const { data: incomes, error: incErr } = await supabaseAdmin
      .from("income_log")
      .select("id, order_id, joki_name, roblox_username, amount, completed_at, product_title, buyer_name")
      .eq("order_id", orderId);
    if (incErr) throw incErr;

    const ids = (incomes || []).map((r) => r.id);
    const feeMap = new Map<number, { gross: number; fee: number; percent: number }>();
    if (ids.length) {
      const { data: fees } = await supabaseAdmin
        .from("income_fee_log")
        .select("income_log_id, gross_amount, fee_amount, fee_percent")
        .in("income_log_id", ids);
      for (const f of fees || []) {
        feeMap.set(f.income_log_id, {
          gross: Number(f.gross_amount) || 0,
          fee: Number(f.fee_amount) || 0,
          percent: Number(f.fee_percent) || 0,
        });
      }
    }

    const joki = await loadJoki(orderId);

    const { data: replacements } = await supabaseAdmin
      .from("account_replacements")
      .select("id, old_username, new_username, old_added_by, new_added_by, status, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    const { data: reprocess } = await supabaseAdmin
      .from("income_reprocess_requests")
      .select("id, status, error, result, created_at, updated_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1);

    const income = (incomes || []).map((r) => {
      const f = feeMap.get(r.id);
      const net = Number(r.amount) || 0;
      return { ...r, net, gross: f ? f.gross : net, fee: f ? f.fee : 0, fee_percent: f ? f.percent : 0 };
    });

    // Tentukan posisi & tindakan yang disarankan
    let kind: "joki" | "akun" = joki ? "joki" : "akun";
    if (joki?.order_type === "akun") kind = "akun";
    let action: "none" | "catat_joki" | "retry_joki" | "catat_akun" = "none";
    let position = "";

    if (income.length > 0) {
      position = "Sudah masuk income";
    } else if (joki) {
      if (jokiDone(joki)) {
        position = "Order joki sudah selesai, tapi pendapatannya belum tercatat";
        action = (joki.total_income ?? 0) > 0 ? "catat_joki" : "retry_joki";
      } else if (joki.bot_process_failed) {
        position = `Gagal di bot${joki.bot_failed_reason ? `: ${joki.bot_failed_reason}` : ""}`;
        action = "retry_joki";
      } else if (joki.queue_status === "processing") {
        position = "Masih dikerjakan (belum waktunya selesai)";
      } else if (joki.queue_status === "queued" || joki.queue_status === "waiting_confirm") {
        position = "Masih di antrian / menunggu konfirmasi penjoki";
      } else {
        position = "Belum dijadwalkan / belum selesai";
      }
    } else {
      position = "Tidak ada di daftar order joki — kemungkinan order akun";
      action = "catat_akun";
    }

    const activeReprocess = reprocess?.[0] && ["pending", "processing"].includes(reprocess[0].status) ? reprocess[0] : null;
    if (action === "catat_akun" && activeReprocess) action = "none";
    if (action === "retry_joki" && joki?.bot_retry_requested) action = "none";

    return NextResponse.json({
      success: true,
      order_id: orderId,
      detail_url: joki?.detail_url || orderDetailUrl(orderId),
      kind,
      position,
      action,
      income,
      joki,
      replacements: replacements || [],
      reprocess: reprocess?.[0] || null,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: errMsg(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = getSession(request);
  if (!isEllan(session)) {
    return NextResponse.json({ success: false, message: "Khusus Ellan" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const orderId = normalizeOrderInput(typeof body.order_id === "string" ? body.order_id : "");
    const action = body.action as "catat_joki" | "retry_joki" | "catat_akun";
    if (!/^OD\d{6,}$/.test(orderId) || !["catat_joki", "retry_joki", "catat_akun"].includes(action)) {
      return NextResponse.json({ success: false, message: "order_id dan action wajib" }, { status: 400 });
    }

    if (action === "catat_akun") {
      const { data: active } = await supabaseAdmin
        .from("income_reprocess_requests")
        .select("id")
        .eq("order_id", orderId)
        .in("status", ["pending", "processing"]);
      if (active && active.length) {
        return NextResponse.json({ success: false, message: "Order ini sudah di antrian catat ulang" }, { status: 409 });
      }
      const { error } = await supabaseAdmin.from("income_reprocess_requests").insert({
        order_id: orderId,
        detail_url: orderDetailUrl(orderId),
        status: "pending",
        requested_by: session?.username || "ellan",
      });
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Bot akan membaca rincian order & mencatat pendapatannya (tanpa chat)" });
    }

    const joki = await loadJoki(orderId);
    if (!joki) {
      return NextResponse.json({ success: false, message: "Order tidak ada di daftar order joki" }, { status: 404 });
    }

    if (action === "catat_joki") {
      if (!jokiDone(joki)) {
        return NextResponse.json({ success: false, message: "Order joki ini belum selesai" }, { status: 400 });
      }
      const amount = Number(joki.total_income) || 0;
      if (amount <= 0) {
        return NextResponse.json({ success: false, message: "Total pendapatan order ini tidak diketahui — pakai Coba ulang" }, { status: 400 });
      }
      const res = await recordIncome({
        order_id: orderId,
        joki_name: joki.joki_name || "ellan",
        product_title: joki.product,
        amount,
        completed_at: joki.completed_at,
        roblox_username: joki.roblox_username,
        buyer_name: joki.buyer_name,
      });
      return NextResponse.json({
        success: true,
        message: res.already ? "Pendapatan order ini ternyata sudah ada" : "Pendapatan berhasil dicatat",
      });
    }

    // retry_joki — sama seperti tombol Coba ulang di Order Gagal
    const count = joki.manual_retry_count ?? 0;
    if (count >= MAX_MANUAL_RETRY) {
      return NextResponse.json({ success: false, message: `Sudah dicoba ulang ${count}x (maks ${MAX_MANUAL_RETRY}x)` }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("joki_orders")
      .update({ bot_retry_requested: true, manual_retry_count: count + 1 })
      .eq("order_id", orderId);
    if (error) throw error;
    return NextResponse.json({ success: true, message: "Bot akan mengulang penyelesaian order ini" });
  } catch (err) {
    return NextResponse.json({ success: false, message: errMsg(err) }, { status: 500 });
  }
}
