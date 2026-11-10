// app/api/rf/route.ts — slot HP Redfinger untuk jokian
//
//   GET  → daftar HP + status (ready / hampir kosong / dipakai / nonaktif) + order yang memakainya
//          Boleh: user login (My Task) atau bot (x-bot-api-key, panel Discord 📱┃slot-redfinger)
//
//   POST { action: "assign", order_id, rf_slot: number | null }
//          → pasang / kosongkan HP Redfinger di order jokian (dropdown di kartu order).
//            User biasa hanya untuk order miliknya. HP harus terdaftar, aktif, dan tidak dipakai order lain.
//   POST { action: "add" | "remove" | "activate" | "deactivate", numbers: number[] }
//          → kelola daftar HP. Bot (tombol di Discord) atau superadmin.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, isSuperadmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SOON_MS = 60 * 60 * 1000; // < 1 jam lagi selesai = "hampir kosong"

type Usage = {
  order_id: string;
  product: string | null;
  joki_name: string | null;
  order_type: string | null;
  queue_status: string | null;
  estimated_end_at: string | null;
  progress_count: number | null;
  target_count: number | null;
  target_unit: string | null;
};
type Device = {
  number: number;
  active: boolean;
  note: string | null;
  status: "ready" | "soon" | "busy" | "inactive";
  orders: Usage[];
};

const isBot = (request: Request) => {
  const key = process.env.BOT_API_KEY;
  return !!key && request.headers.get("x-bot-api-key") === key;
};
const fail = (message: string, status = 400) => NextResponse.json({ success: false, message }, { status });
const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : (err as { message?: string })?.message || "Terjadi kesalahan";

/** Order jokian yang masih berjalan (HP-nya belum boleh dipakai order lain) */
function isRunning(o: { completed?: boolean | null; completed_by_bot?: boolean | null; queue_status?: string | null }) {
  return !o.completed && !o.completed_by_bot && o.queue_status !== "completed";
}

async function loadStatus() {
  const [{ data: devices, error: dErr }, { data: orders, error: oErr }] = await Promise.all([
    supabaseAdmin.from("rf_devices").select("number, active, note").order("number"),
    supabaseAdmin
      .from("joki_orders")
      .select(
        "order_id, product, joki_name, order_type, queue_status, estimated_end_at, progress_count, target_count, target_unit, rf_slot, completed, completed_by_bot"
      )
      .not("rf_slot", "is", null),
  ]);
  if (dErr) throw dErr;
  if (oErr) throw oErr;

  const byNumber = new Map<number, Usage[]>();
  for (const o of orders || []) {
    if (!isRunning(o)) continue;
    const list = byNumber.get(o.rf_slot as number) || [];
    list.push({
      order_id: o.order_id,
      product: o.product,
      joki_name: o.joki_name,
      order_type: o.order_type,
      queue_status: o.queue_status,
      estimated_end_at: o.estimated_end_at,
      progress_count: o.progress_count,
      target_count: o.target_count,
      target_unit: o.target_unit,
    });
    byNumber.set(o.rf_slot as number, list);
  }

  const now = Date.now();
  const list: Device[] = (devices || []).map((d) => {
    const used = byNumber.get(d.number) || [];
    let status: Device["status"] = "ready";
    if (!d.active) status = "inactive";
    else if (used.length) {
      // Hampir kosong: semua order di HP ini countdown & selesai < 1 jam lagi
      const soon = used.every(
        (u) => u.order_type !== "progress" && u.estimated_end_at && new Date(u.estimated_end_at).getTime() - now < SOON_MS
      );
      status = soon ? "soon" : "busy";
    }
    return { number: d.number, active: d.active, note: d.note, status, orders: used };
  });

  // HP yang dipakai order tapi belum terdaftar (mis. didaftarkan belakangan) tetap ditampilkan
  for (const [number, used] of byNumber) {
    if (!list.some((d) => d.number === number)) {
      list.push({ number, active: true, note: "belum terdaftar", status: "busy", orders: used });
    }
  }
  list.sort((a, b) => a.number - b.number);

  const { count: waiting, error: wErr } = await supabaseAdmin
    .from("joki_orders")
    .select("id", { count: "exact", head: true })
    .eq("completed", false)
    .in("queue_status", ["queued", "waiting_confirm"]);
  if (wErr) throw wErr;

  return { devices: list, waiting: waiting || 0 };
}

export async function GET(request: Request) {
  if (!isBot(request) && !getSession(request)) return fail("Unauthorized", 401);
  try {
    const data = await loadStatus();
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    const msg = errorMessage(err);
    if (/rf_devices|rf_slot/i.test(msg)) return fail("Tabel HP Redfinger belum ada — jalankan sql/016_redfinger_slots.sql", 500);
    return fail(msg, 500);
  }
}

function parseNumbers(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<number>();
  for (const v of raw) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0 && n < 100000) out.add(n);
  }
  return [...out].slice(0, 200);
}

export async function POST(request: Request) {
  const bot = isBot(request);
  const session = getSession(request);
  if (!bot && !session) return fail("Unauthorized", 401);

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    // ── Pasang / kosongkan HP di order ──
    if (action === "assign") {
      const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
      if (!orderId) return fail("order_id wajib");
      const slot = body.rf_slot === null || body.rf_slot === "" ? null : Number(body.rf_slot);
      if (slot !== null && !(Number.isInteger(slot) && slot > 0)) return fail("Nomor HP tidak valid");

      const { data: order, error } = await supabaseAdmin
        .from("joki_orders")
        .select("order_id, joki_name, rf_slot")
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      if (!order) return fail("Order tidak ditemukan", 404);
      if (!bot && session && !isSuperadmin(session) && (order.joki_name || "").toLowerCase() !== session.username.toLowerCase()) {
        return fail("Bukan order kamu", 403);
      }

      if (slot !== null && slot !== order.rf_slot) {
        const { devices } = await loadStatus();
        const dev = devices.find((d) => d.number === slot);
        if (!dev || dev.note === "belum terdaftar") return fail(`HP ${slot} belum terdaftar. Tambahkan dulu lewat Discord.`);
        if (!dev.active) return fail(`HP ${slot} sedang dinonaktifkan`);
        const other = dev.orders.find((u) => u.order_id !== orderId);
        if (other) return fail(`HP ${slot} sedang dipakai order #${other.order_id.replace(/^OD0*/, "")}`, 409);
      }

      const { error: upErr } = await supabaseAdmin.from("joki_orders").update({ rf_slot: slot }).eq("order_id", orderId);
      if (upErr) throw upErr;
      return NextResponse.json({ success: true, rf_slot: slot });
    }

    // ── Kelola daftar HP (Discord / superadmin) ──
    if (!bot && !(session && isSuperadmin(session))) return fail("Khusus admin", 403);
    const numbers = parseNumbers(body.numbers);
    if (!numbers.length) return fail("Nomor HP wajib diisi");

    if (action === "add") {
      const { data: existing, error } = await supabaseAdmin.from("rf_devices").select("number").in("number", numbers);
      if (error) throw error;
      const have = new Set((existing || []).map((d) => d.number));
      const fresh = numbers.filter((n) => !have.has(n));
      if (fresh.length) {
        const { error: insErr } = await supabaseAdmin.from("rf_devices").insert(fresh.map((number) => ({ number })));
        if (insErr) throw insErr;
      }
      return NextResponse.json({ success: true, added: fresh, skipped: numbers.filter((n) => have.has(n)) });
    }

    if (action === "remove") {
      // HP yang masih dipakai order tidak boleh dihapus
      const { devices } = await loadStatus();
      const busy = numbers.filter((n) => devices.find((d) => d.number === n)?.orders.length);
      const target = numbers.filter((n) => !busy.includes(n));
      let removed: number[] = [];
      if (target.length) {
        const { data, error } = await supabaseAdmin.from("rf_devices").delete().in("number", target).select("number");
        if (error) throw error;
        removed = (data || []).map((d) => d.number);
      }
      return NextResponse.json({
        success: true,
        removed,
        busy,
        missing: target.filter((n) => !removed.includes(n)),
      });
    }

    if (action === "activate" || action === "deactivate") {
      const { data, error } = await supabaseAdmin
        .from("rf_devices")
        .update({ active: action === "activate" })
        .in("number", numbers)
        .select("number");
      if (error) throw error;
      const changed = (data || []).map((d) => d.number);
      return NextResponse.json({ success: true, changed, missing: numbers.filter((n) => !changed.includes(n)) });
    }

    return fail("action tidak dikenal");
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}
