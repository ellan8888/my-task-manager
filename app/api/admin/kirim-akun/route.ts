// app/api/admin/kirim-akun/route.ts — Kirim Akun Manual (khusus Ellan)
//
//   GET ?mode=history                → riwayat (tanpa password)
//   GET ?mode=stock&q=...            → akun stok yang sedang dijual di Itemku
//   GET ?mode=users                  → daftar user aktif (untuk pemilik akun baru)
//   GET ?mode=check&order_id=...     → cek order: sudah ada pendapatan? sedang diproses?
//   POST { order_id, source:'stock'|'new', stock_usernames?, new_accounts?, owner?, kategori? }
//   PATCH { id, action:'retry'|'cancel'|'finalize' }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { ACTIVE_STATUSES, cleanOrderId, isEllan, orderDetailUrl } from "@/lib/replacements";
import {
  ACTIVE_DELIVERY_STATUSES,
  finalizeDelivery,
  isRobloxUsername,
  publicDelivery,
  type DeliveryAccount,
  type DeliveryRow,
} from "@/lib/manualDelivery";

export const dynamic = "force-dynamic";

const forbidden = () => NextResponse.json({ success: false, message: "Khusus Ellan" }, { status: 403 });
const bad = (message: string, status = 400) => NextResponse.json({ success: false, message }, { status });
const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : (err as { message?: string })?.message || "Terjadi kesalahan";
const isMissingTable = (err: unknown) => /manual_deliveries/i.test(errorMessage(err));

/** "167663006" → "OD000000167663006" */
function normalizeOrder(raw: string) {
  const v = cleanOrderId(raw || "").replace(/[#\s]/g, "");
  return /^\d+$/.test(v) ? `OD${v.padStart(15, "0")}` : v;
}

/** Username yang sedang dipakai proses lain (kirim manual / ganti akun) */
async function busyUsernames(): Promise<Set<string>> {
  const [{ data: md }, { data: rep }] = await Promise.all([
    supabaseAdmin.from("manual_deliveries").select("accounts").in("status", ACTIVE_DELIVERY_STATUSES),
    supabaseAdmin.from("account_replacements").select("new_username").in("status", ACTIVE_STATUSES),
  ]);
  const set = new Set<string>();
  (md || []).forEach((r) => ((r.accounts as DeliveryAccount[]) || []).forEach((a) => set.add(a.username.toLowerCase())));
  (rep || []).forEach((r) => r.new_username && set.add(r.new_username.toLowerCase()));
  return set;
}

async function orderStatus(orderId: string) {
  const [{ data: income }, { data: active }] = await Promise.all([
    supabaseAdmin.from("income_log").select("roblox_username, joki_name").eq("order_id", orderId),
    supabaseAdmin.from("manual_deliveries").select("id, status").eq("order_id", orderId).in("status", ACTIVE_DELIVERY_STATUSES),
  ]);
  return { income: income || [], active: active || [] };
}

export async function GET(request: Request) {
  if (!isEllan(getSession(request))) return forbidden();
  const sp = new URL(request.url).searchParams;
  const mode = sp.get("mode") || "history";

  try {
    if (mode === "users") {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("username, display_name, role, is_active")
        .order("username", { ascending: true });
      if (error) throw error;
      return NextResponse.json({
        success: true,
        data: (data || [])
          .filter((u) => u.is_active !== false)
          .map((u) => ({ username: String(u.username).toLowerCase(), display_name: u.display_name, role: u.role })),
      });
    }

    if (mode === "stock") {
      const q = (sp.get("q") || "").trim();
      let query = supabaseAdmin
        .from("accounts_stock")
        .select("username, password, kategori, added_by, used_at, created_at")
        .eq("status", "listed")
        .eq("used", true)
        .eq("logged_out", false)
        .eq("deleted", false)
        .order("used_at", { ascending: true, nullsFirst: false })
        .limit(60);
      if (q) query = query.or(`username.ilike.%${q.replace(/[%,()]/g, "")}%,kategori.ilike.%${q.replace(/[%,()]/g, "")}%`);
      const { data, error } = await query;
      if (error) throw error;
      const busy = await busyUsernames();
      return NextResponse.json({
        success: true,
        data: (data || [])
          .filter((a) => !busy.has(a.username.toLowerCase()))
          .map((a) => ({
            username: a.username,
            kategori: a.kategori,
            added_by: a.added_by,
            listed_at: a.used_at || a.created_at,
            has_password: !!a.password,
          })),
      });
    }

    if (mode === "check") {
      const orderId = normalizeOrder(sp.get("order_id") || "");
      if (!/^OD\d{6,}$/.test(orderId)) return NextResponse.json({ success: true, valid: false, order_id: orderId });
      const st = await orderStatus(orderId);
      return NextResponse.json({
        success: true,
        valid: true,
        order_id: orderId,
        income_usernames: st.income.map((r) => r.roblox_username).filter(Boolean),
        in_progress: st.active.length > 0,
      });
    }

    // history
    const { data, error } = await supabaseAdmin
      .from("manual_deliveries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      if (isMissingTable(error)) return NextResponse.json({ success: true, ready: false, data: [] });
      throw error;
    }
    return NextResponse.json({ success: true, ready: true, data: (data as DeliveryRow[]).map(publicDelivery) });
  } catch (err) {
    return bad(errorMessage(err), 500);
  }
}

export async function POST(request: Request) {
  const session = getSession(request);
  if (!isEllan(session)) return forbidden();

  try {
    const body = await request.json().catch(() => ({}));
    const orderId = normalizeOrder(typeof body.order_id === "string" ? body.order_id : "");
    const source = body.source === "new" ? "new" : body.source === "stock" ? "stock" : null;
    const detailUrl = orderDetailUrl(orderId);

    if (!/^OD\d{6,}$/.test(orderId) || !detailUrl) return bad("Order ID tidak valid, contoh: OD000000167663006");
    if (!source) return bad("Pilih sumber akun");

    const st = await orderStatus(orderId);
    if (st.active.length) return bad("Order ini sedang diproses kirim akun manual — cek riwayat", 409);
    if (st.income.length) {
      return bad(
        `Order ini sudah punya pendapatan tercatat (${st.income.map((r) => r.roblox_username).join(", ")}). ` +
          "Kalau akunnya bermasalah, pakai Ganti Akun.",
        409
      );
    }

    const busy = await busyUsernames();
    let accounts: DeliveryAccount[] = [];
    let kategori: string | null = null;

    if (source === "stock") {
      const names: string[] = Array.isArray(body.stock_usernames)
        ? [...new Set<string>(body.stock_usernames.map((u: unknown) => String(u).trim()).filter(Boolean))]
        : [];
      if (!names.length) return bad("Pilih minimal satu akun stok");
      if (names.length > 10) return bad("Maksimal 10 akun per order");

      const { data: rows, error } = await supabaseAdmin
        .from("accounts_stock")
        .select("username, password, kategori, added_by, status, used, logged_out, deleted")
        .in("username", names);
      if (error) throw error;
      for (const n of names) {
        const a = (rows || []).find((r) => r.username === n);
        if (!a || a.status !== "listed" || !a.used || a.logged_out || a.deleted) {
          return bad(`${n} bukan akun yang sedang dijual di Itemku`);
        }
        if (!a.password) return bad(`${n} belum punya password`);
        if (busy.has(n.toLowerCase())) return bad(`${n} sedang dipakai proses lain (kirim manual / ganti akun)`);
        accounts.push({ username: a.username, kategori: a.kategori, owner: (a.added_by || "ellan").toLowerCase() });
      }
    } else {
      const owner = String(body.owner || "").toLowerCase().trim();
      if (!owner) return bad("Pilih pemilik akun");
      const { data: u } = await supabaseAdmin
        .from("users")
        .select("username, is_active")
        .ilike("username", owner)
        .maybeSingle();
      if (!u || u.is_active === false) return bad("Pemilik akun tidak dikenal");

      kategori = typeof body.kategori === "string" && body.kategori.trim() ? body.kategori.trim().slice(0, 100) : null;
      const list: { username?: unknown; password?: unknown }[] = Array.isArray(body.new_accounts) ? body.new_accounts : [];
      const cleaned = list
        .map((a) => ({ username: String(a.username || "").trim(), password: String(a.password || "") }))
        .filter((a) => a.username || a.password);
      if (!cleaned.length) return bad("Isi minimal satu akun");
      if (cleaned.length > 10) return bad("Maksimal 10 akun per order");

      const seen = new Set<string>();
      for (const a of cleaned) {
        if (!isRobloxUsername(a.username)) return bad(`Username "${a.username}" tidak valid (3–20 huruf/angka/_)`);
        if (!a.password.trim()) return bad(`Password ${a.username} wajib diisi`);
        if (seen.has(a.username.toLowerCase())) return bad(`${a.username} diisi dua kali`);
        seen.add(a.username.toLowerCase());
        if (busy.has(a.username.toLowerCase())) return bad(`${a.username} sedang dipakai proses lain`);
      }
      const { data: exists } = await supabaseAdmin
        .from("accounts_stock")
        .select("username")
        .in("username", cleaned.map((a) => a.username));
      if (exists && exists.length) {
        return bad(`Sudah ada di data akun: ${exists.map((e) => e.username).join(", ")}. Pilih dari stok Itemku saja.`);
      }
      accounts = cleaned.map((a) => ({ username: a.username, password: a.password, kategori, owner: u.username.toLowerCase() }));
    }

    const { data, error } = await supabaseAdmin
      .from("manual_deliveries")
      .insert({
        order_id: orderId,
        detail_url: detailUrl,
        source,
        accounts,
        kategori,
        status: "pending",
        requested_by: session?.username || "ellan",
      })
      .select("*")
      .single();
    if (error) {
      if (isMissingTable(error)) return bad("Jalankan SQL 011 dulu di Supabase");
      throw error;
    }
    return NextResponse.json({
      success: true,
      data: publicDelivery(data as DeliveryRow),
      message: "Permintaan dikirim — bot akan memprosesnya dalam beberapa saat",
    });
  } catch (err) {
    return bad(errorMessage(err), 500);
  }
}

export async function PATCH(request: Request) {
  if (!isEllan(getSession(request))) return forbidden();
  try {
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    const action = body.action as "retry" | "cancel" | "finalize";
    if (!Number.isFinite(id) || !["retry", "cancel", "finalize"].includes(action)) return bad("id dan action wajib");

    const { data: row, error } = await supabaseAdmin.from("manual_deliveries").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!row) return bad("Tidak ditemukan", 404);
    const now = new Date().toISOString();

    if (action === "cancel") {
      if (!["pending", "failed"].includes(row.status)) return bad("Hanya yang menunggu / gagal yang bisa dibatalkan");
      await supabaseAdmin.from("manual_deliveries").update({ status: "cancelled", updated_at: now }).eq("id", id);
      return NextResponse.json({ success: true, message: "Dibatalkan" });
    }
    if (action === "retry") {
      if (row.status !== "failed") return bad("Hanya yang gagal yang bisa diulang");
      await supabaseAdmin.from("manual_deliveries").update({ status: "pending", step: null, error: null, updated_at: now }).eq("id", id);
      return NextResponse.json({ success: true, message: "Diulang — bot akan memprosesnya lagi" });
    }
    // finalize ulang
    if (row.status !== "finalize_failed") return bad("Tidak perlu diselesaikan ulang");
    const res = await finalizeDelivery(row as DeliveryRow);
    await supabaseAdmin
      .from("manual_deliveries")
      .update(res.ok ? { status: "done", error: null, done_at: now, updated_at: now } : { error: res.error, updated_at: now })
      .eq("id", id);
    return NextResponse.json({ success: res.ok, message: res.ok ? "Selesai" : res.error });
  } catch (err) {
    return bad(errorMessage(err), 500);
  }
}
