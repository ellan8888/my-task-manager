// app/api/bot/buyer/route.ts — dipakai bot Discord (header x-bot-api-key)
//
//   GET ?mode=verify&order_id=OD...  → apakah Order ID ini benar pesanan di toko kita?
//        { valid, kind: "akun" | "joki", product }
//   GET ?mode=recent → 30 penjualan terakhir (id, order_id, produk, waktu) untuk feed "Baru saja terjual".
//        TANPA nama pembeli & nominal.
//   GET ?mode=stats  → { total_sold } untuk statistik server.
//   GET ?mode=orders&discord_id=123 → pesanan milik akun Discord ini (30 hari terakhir + jokian aktif)
//        { linked, orders: [{ order_id, kind, product, date, accounts, active, status }] }
//        akun : aktif selama masa garansi (7 hari sejak dibeli)
//        joki : aktif selama masih ada di antrean (belum selesai)
//
//   POST { mode: "link", discord_id, discord_name, order_id, source }
//        → kaitkan Order ID ke akun Discord. Satu Order ID hanya untuk satu akun Discord.
//          Nama pembeli Itemku dari order itu ikut disimpan, jadi pesanan berikutnya dengan
//          nama yang sama otomatis dikenali.
//        { valid, kind, product, conflict? }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const WARRANTY_DAYS = 7;
const HISTORY_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

const isBot = (request: Request) => {
  const key = process.env.BOT_API_KEY;
  return !!key && request.headers.get("x-bot-api-key") === key;
};
const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : (err as { message?: string })?.message || "Terjadi kesalahan";

/** "167663006" / "#OD000000167663006 (ID)" → "OD000000167663006" */
function normalizeOrderId(raw: string) {
  const v = raw.trim().replace(/\s*\([A-Za-z]{2}\)\s*$/, "").replace(/[#\s]/g, "").toUpperCase();
  return /^\d+$/.test(v) ? "OD" + v.padStart(15, "0") : v;
}
const isAkun = (title?: string | null) => /akun|account|starter/i.test(title || "");
const cleanName = (n?: string | null) => {
  const v = (n || "").trim();
  return v && v !== "-" ? v : null;
};

type Found = { valid: boolean; kind?: "akun" | "joki"; product?: string | null; buyer_name?: string | null };

async function findOrder(orderId: string): Promise<Found> {
  // Order ID boleh tersimpan dengan akhiran " (ID)" → cocokkan awalan
  const { data: joki, error: jokiErr } = await supabaseAdmin
    .from("joki_orders")
    .select("order_id, product, buyer_name")
    .ilike("order_id", `${orderId}%`)
    .limit(1);
  if (jokiErr) throw jokiErr;
  if (joki?.length) return { valid: true, kind: "joki", product: joki[0].product || null, buyer_name: cleanName(joki[0].buyer_name) };

  const { data: income, error: incErr } = await supabaseAdmin
    .from("income_log")
    .select("order_id, product_title, buyer_name")
    .ilike("order_id", `${orderId}%`)
    .limit(5);
  if (incErr) throw incErr;
  if (income?.length) {
    return {
      valid: true,
      // income_log berisi akun & joki → tentukan dari judul produk (sama seperti bot)
      kind: isAkun(income[0].product_title) ? "akun" : "joki",
      product: income[0].product_title || null,
      buyer_name: income.map((r) => cleanName(r.buyer_name)).find(Boolean) || null,
    };
  }
  return { valid: false };
}

export async function GET(request: Request) {
  if (!isBot(request)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "recent") {
      const { data, error } = await supabaseAdmin
        .from("income_log")
        .select("id, order_id, product_title, completed_at")
        .order("completed_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return NextResponse.json({
        success: true,
        data: (data || []).map((r) => ({
          id: String(r.id),
          order_id: r.order_id,
          product: r.product_title || null,
          kind: isAkun(r.product_title) ? "akun" : "joki",
          completed_at: r.completed_at,
        })),
      });
    }

    if (mode === "stats") {
      const { count, error } = await supabaseAdmin.from("income_log").select("id", { count: "exact", head: true });
      if (error) throw error;
      return NextResponse.json({ success: true, total_sold: count || 0 });
    }

    if (mode === "orders") return await listOrders(searchParams.get("discord_id") || "");

    if (mode !== "verify") return NextResponse.json({ success: false, message: "mode tidak dikenal" }, { status: 400 });

    const orderId = normalizeOrderId(searchParams.get("order_id") || "");
    if (!/^OD\d{6,}$/.test(orderId)) return NextResponse.json({ success: true, valid: false, reason: "format" });
    const f = await findOrder(orderId);
    if (!f.valid) return NextResponse.json({ success: true, valid: false, order_id: orderId, reason: "not_found" });
    return NextResponse.json({ success: true, valid: true, order_id: orderId, kind: f.kind, product: f.product || null });
  } catch (err) {
    return NextResponse.json({ success: false, message: errorMessage(err) }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────
// Daftar pesanan milik akun Discord
// ──────────────────────────────────────────────────────────────
type OrderOut = {
  order_id: string;
  kind: "akun" | "joki";
  product: string | null;
  date: string | null;
  accounts: string[];
  quantity: string | null;
  active: boolean;
  status: string; // akun: garansi | garansi_habis — joki: queued | processing | waiting_confirm | selesai
  warranty_until?: string | null;
};
type Row = Record<string, unknown>;

async function listOrders(discordId: string) {
  if (!/^\d{5,25}$/.test(discordId)) {
    return NextResponse.json({ success: false, message: "discord_id tidak valid" }, { status: 400 });
  }
  const [{ data: links, error: lErr }, { data: buyer, error: bErr }] = await Promise.all([
    supabaseAdmin.from("discord_buyer_links").select("order_id").eq("discord_id", discordId),
    supabaseAdmin.from("discord_buyers").select("itemku_names").eq("discord_id", discordId).maybeSingle(),
  ]);
  if (lErr) throw lErr;
  if (bErr) throw bErr;

  const linkedIds = [...new Set((links || []).map((l) => l.order_id as string))];
  const names = ((buyer?.itemku_names as string[]) || []).filter(Boolean);
  if (!linkedIds.length && !names.length) return NextResponse.json({ success: true, linked: false, orders: [] });

  const since = new Date(Date.now() - HISTORY_DAYS * DAY).toISOString();
  const incomeSel = "order_id, product_title, roblox_username, created_at";
  const jokiSel = "order_id, product, quantity, queue_status, created_at";

  const incomeQ = [];
  const jokiQ = [];
  if (linkedIds.length) {
    incomeQ.push(supabaseAdmin.from("income_log").select(incomeSel).in("order_id", linkedIds).gte("created_at", since));
    jokiQ.push(supabaseAdmin.from("joki_orders").select(jokiSel).in("order_id", linkedIds));
  }
  if (names.length) {
    incomeQ.push(supabaseAdmin.from("income_log").select(incomeSel).in("buyer_name", names).gte("created_at", since));
    jokiQ.push(supabaseAdmin.from("joki_orders").select(jokiSel).in("buyer_name", names));
  }
  const [incomeRes, jokiRes] = await Promise.all([Promise.all(incomeQ), Promise.all(jokiQ)]);
  const incomeRows: Row[] = [];
  const jokiRows: Row[] = [];
  for (const r of incomeRes) {
    if (r.error) throw r.error;
    incomeRows.push(...((r.data as Row[]) || []));
  }
  for (const r of jokiRes) {
    if (r.error) throw r.error;
    jokiRows.push(...((r.data as Row[]) || []));
  }

  // Order yang dikaitkan ke akun Discord LAIN tidak ikut ditampilkan
  const candidateIds = [...new Set([...incomeRows, ...jokiRows].map((r) => normalizeOrderId(String(r.order_id))))];
  const takenByOthers = new Set<string>();
  if (candidateIds.length) {
    const { data: other, error } = await supabaseAdmin
      .from("discord_buyer_links")
      .select("order_id")
      .in("order_id", candidateIds)
      .neq("discord_id", discordId);
    if (error) throw error;
    (other || []).forEach((o) => takenByOthers.add(o.order_id as string));
  }

  const now = Date.now();
  const orders = new Map<string, OrderOut>();

  // Jokian yang masih di antrean = aktif
  for (const r of jokiRows) {
    const id = normalizeOrderId(String(r.order_id));
    if (takenByOthers.has(id) || orders.has(id)) continue;
    orders.set(id, {
      order_id: id,
      kind: "joki",
      product: (r.product as string) || null,
      date: (r.created_at as string) || null,
      accounts: [],
      quantity: (r.quantity as string) || null,
      active: true,
      status: (r.queue_status as string) || "queued",
    });
  }

  // income_log: akun (garansi 7 hari) & jokian yang sudah selesai
  for (const r of incomeRows) {
    const id = normalizeOrderId(String(r.order_id));
    if (takenByOthers.has(id)) continue;
    const existing = orders.get(id);
    if (existing?.kind === "joki" && existing.active) continue; // masih di antrean
    const created = (r.created_at as string) || null;
    const user = cleanName(r.roblox_username as string);
    if (existing) {
      if (existing.kind === "akun" && user && !existing.accounts.includes(user)) existing.accounts.push(user);
      if (created && (!existing.date || created < existing.date)) existing.date = created;
      continue;
    }
    const akun = isAkun(r.product_title as string);
    orders.set(id, {
      order_id: id,
      kind: akun ? "akun" : "joki",
      product: (r.product_title as string) || null,
      date: created,
      accounts: akun && user ? [user] : [],
      quantity: null,
      active: false,
      status: akun ? "garansi_habis" : "selesai",
    });
  }

  for (const o of orders.values()) {
    if (o.kind !== "akun") continue;
    const start = o.date ? new Date(o.date).getTime() : 0;
    const until = start + WARRANTY_DAYS * DAY;
    o.warranty_until = start ? new Date(until).toISOString() : null;
    o.active = !!start && now < until;
    o.status = o.active ? "garansi" : "garansi_habis";
  }

  const list = [...orders.values()].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  return NextResponse.json({ success: true, linked: true, warranty_days: WARRANTY_DAYS, orders: list.slice(0, 60) });
}

// ──────────────────────────────────────────────────────────────
// Kaitkan Order ID ke akun Discord
// ──────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  if (!isBot(request)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    if (body.mode !== "link") return NextResponse.json({ success: false, message: "mode tidak dikenal" }, { status: 400 });

    const discordId = String(body.discord_id || "");
    const discordName = String(body.discord_name || "").slice(0, 100) || null;
    const source = ["verify", "gate", "ticket", "import"].includes(body.source) ? body.source : "verify";
    const orderId = normalizeOrderId(String(body.order_id || ""));
    if (!/^\d{5,25}$/.test(discordId)) return NextResponse.json({ success: false, message: "discord_id tidak valid" }, { status: 400 });
    if (!/^OD\d{6,}$/.test(orderId)) return NextResponse.json({ success: true, valid: false, reason: "format" });

    const f = await findOrder(orderId);
    if (!f.valid) return NextResponse.json({ success: true, valid: false, order_id: orderId, reason: "not_found" });

    const conflict = () =>
      NextResponse.json({ success: true, valid: true, conflict: true, order_id: orderId, kind: f.kind, product: f.product || null });

    const { data: existing, error: exErr } = await supabaseAdmin
      .from("discord_buyer_links")
      .select("discord_id")
      .eq("order_id", orderId)
      .maybeSingle();
    if (exErr) throw exErr;
    if (existing && existing.discord_id !== discordId) return conflict();

    if (!existing) {
      const { error } = await supabaseAdmin.from("discord_buyer_links").insert({
        order_id: orderId,
        discord_id: discordId,
        discord_name: discordName,
        buyer_name: f.buyer_name || null,
        source,
      });
      // 23505 = baru saja dikaitkan oleh proses lain → cek ulang pemiliknya
      if (error?.code === "23505") {
        const { data: again } = await supabaseAdmin.from("discord_buyer_links").select("discord_id").eq("order_id", orderId).maybeSingle();
        if (again && again.discord_id !== discordId) return conflict();
      } else if (error) throw error;
    }

    // Simpan nama pembeli Itemku → pesanan berikutnya otomatis dikenali
    const { data: buyer, error: bErr } = await supabaseAdmin
      .from("discord_buyers")
      .select("itemku_names")
      .eq("discord_id", discordId)
      .maybeSingle();
    if (bErr) throw bErr;
    const names = ((buyer?.itemku_names as string[]) || []).filter(Boolean);
    if (f.buyer_name && !names.includes(f.buyer_name)) names.push(f.buyer_name);
    const { error: upErr } = await supabaseAdmin.from("discord_buyers").upsert({
      discord_id: discordId,
      discord_name: discordName,
      itemku_names: names.slice(-5),
      updated_at: new Date().toISOString(),
    });
    if (upErr) throw upErr;

    return NextResponse.json({ success: true, valid: true, order_id: orderId, kind: f.kind, product: f.product || null });
  } catch (err) {
    return NextResponse.json({ success: false, message: errorMessage(err) }, { status: 500 });
  }
}
