// app/api/admin/ganti-akun/route.ts — khusus Ellan
//   GET   → riwayat penggantian
//   POST  → buat permintaan ganti akun (bot yang mengerjakan)
//   PATCH → coba ulang / batalkan / selesaikan data
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import {
  ACTIVE_STATUSES,
  cleanOrderId,
  finalizeReplacement,
  isEllan,
  orderDetailUrl,
  type ReplacementRow,
} from "@/lib/replacements";

export const dynamic = "force-dynamic";

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : (err as { message?: string })?.message || "Terjadi kesalahan";

const forbidden = () => NextResponse.json({ success: false, message: "Khusus Ellan" }, { status: 403 });

export async function GET(request: Request) {
  if (!isEllan(getSession(request))) return forbidden();
  try {
    const { data, error } = await supabaseAdmin
      .from("account_replacements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    return NextResponse.json({ success: false, message: errorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = getSession(request);
  if (!isEllan(session)) return forbidden();

  try {
    const body = await request.json().catch(() => ({}));
    const oldUsername = typeof body.old_username === "string" ? body.old_username.trim() : "";
    const newUsername = typeof body.new_username === "string" ? body.new_username.trim() : "";
    const orderId = typeof body.order_id === "string" ? cleanOrderId(body.order_id) : "";

    if (!oldUsername || !newUsername || !orderId) {
      return NextResponse.json({ success: false, message: "Akun lama, akun pengganti, dan nomor order wajib" }, { status: 400 });
    }
    const detailUrl = orderDetailUrl(orderId);
    if (!detailUrl) {
      return NextResponse.json({ success: false, message: `Nomor order "${orderId}" tidak dikenali` }, { status: 400 });
    }

    // Akun lama harus sudah laku
    const { data: oldAcc } = await supabaseAdmin
      .from("accounts_stock")
      .select("username, kategori, added_by, logged_out")
      .eq("username", oldUsername)
      .maybeSingle();
    if (!oldAcc || !oldAcc.logged_out) {
      return NextResponse.json({ success: false, message: "Akun bermasalah tidak ditemukan di daftar akun laku" }, { status: 400 });
    }

    // Akun pengganti harus sedang dijual di Itemku, kategori sama, punya password
    const { data: newAcc } = await supabaseAdmin
      .from("accounts_stock")
      .select("username, password, kategori, added_by, status, used, logged_out, deleted")
      .eq("username", newUsername)
      .maybeSingle();
    if (!newAcc || newAcc.status !== "listed" || !newAcc.used || newAcc.logged_out || newAcc.deleted) {
      return NextResponse.json(
        { success: false, message: "Akun pengganti harus akun yang sedang dijual di Itemku dan belum laku" },
        { status: 400 }
      );
    }
    if ((newAcc.kategori || "").toLowerCase().trim() !== (oldAcc.kategori || "").toLowerCase().trim()) {
      return NextResponse.json({ success: false, message: "Kategori akun pengganti harus sama" }, { status: 400 });
    }
    if (!newAcc.password) {
      return NextResponse.json({ success: false, message: "Akun pengganti belum punya password" }, { status: 400 });
    }

    // Jangan dobel
    const { data: clash } = await supabaseAdmin
      .from("account_replacements")
      .select("id, old_username, new_username")
      .in("status", ACTIVE_STATUSES)
      .or(`old_username.eq.${oldUsername},new_username.eq.${newUsername}`);
    if (clash && clash.length > 0) {
      return NextResponse.json(
        { success: false, message: "Akun ini sudah ada di proses ganti akun yang belum selesai" },
        { status: 409 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("account_replacements")
      .insert({
        order_id: orderId,
        detail_url: detailUrl,
        kategori: oldAcc.kategori,
        old_username: oldAcc.username,
        old_added_by: oldAcc.added_by,
        new_username: newAcc.username,
        new_added_by: newAcc.added_by,
        status: "pending",
        requested_by: session?.username || "ellan",
      })
      .select("*")
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, data, message: "Permintaan dikirim — bot akan memprosesnya" });
  } catch (err) {
    return NextResponse.json({ success: false, message: errorMessage(err) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isEllan(getSession(request))) return forbidden();

  try {
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    const action = body.action as "retry" | "cancel" | "finalize";
    if (!Number.isFinite(id) || !["retry", "cancel", "finalize"].includes(action)) {
      return NextResponse.json({ success: false, message: "id dan action wajib" }, { status: 400 });
    }

    const { data: rep, error: getErr } = await supabaseAdmin
      .from("account_replacements")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!rep) return NextResponse.json({ success: false, message: "Data tidak ditemukan" }, { status: 404 });

    const now = new Date().toISOString();

    if (action === "retry") {
      if (rep.status !== "failed") {
        return NextResponse.json({ success: false, message: "Hanya yang gagal yang bisa dicoba ulang" }, { status: 400 });
      }
      await supabaseAdmin
        .from("account_replacements")
        .update({ status: "pending", error: null, updated_at: now })
        .eq("id", id);
      return NextResponse.json({ success: true, message: "Dikirim ulang ke bot" });
    }

    if (action === "cancel") {
      if (!["pending", "failed"].includes(rep.status)) {
        return NextResponse.json({ success: false, message: "Tidak bisa dibatalkan pada status ini" }, { status: 400 });
      }
      await supabaseAdmin.from("account_replacements").update({ status: "cancelled", updated_at: now }).eq("id", id);
      return NextResponse.json({ success: true, message: "Dibatalkan" });
    }

    // finalize — chat sudah terkirim tapi update data sebelumnya gagal
    if (rep.status !== "finalize_failed") {
      return NextResponse.json({ success: false, message: "Tidak perlu diselesaikan ulang" }, { status: 400 });
    }
    const result = await finalizeReplacement(rep as ReplacementRow);
    await supabaseAdmin
      .from("account_replacements")
      .update(
        result.ok
          ? { status: "done", error: null, note: result.note ?? null, done_at: now, updated_at: now }
          : { error: result.error, updated_at: now }
      )
      .eq("id", id);
    return NextResponse.json(
      result.ok ? { success: true, message: "Data berhasil diselesaikan" } : { success: false, message: result.error },
      { status: result.ok ? 200 : 500 }
    );
  } catch (err) {
    return NextResponse.json({ success: false, message: errorMessage(err) }, { status: 500 });
  }
}
