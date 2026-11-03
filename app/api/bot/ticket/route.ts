// app/api/bot/ticket/route.ts — dipakai bot Discord (header x-bot-api-key)
//
//   GET  ?mode=check&order_id=OD...&username=Sae_xxx
//        Cek laporan buyer: order ada? username ada di order itu? siapa pemilik akunnya?
//        Dipakai saat buyer membuka ticket, supaya tim langsung tahu datanya benar atau tidak.
//
//   GET  ?mode=updates
//        Ganti Akun yang dibuat dari ticket dan sudah selesai / gagal, tapi belum
//        dikabarkan ke ticket. Untuk yang selesai, berisi username & password akun pengganti.
//
//   POST { id, status }
//        Bot menandai hasil Ganti Akun sudah dikirim ke ticket.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanOrderId } from "@/lib/replacements";

export const dynamic = "force-dynamic";

const isBot = (request: Request) => {
  const key = process.env.BOT_API_KEY;
  return !!key && request.headers.get("x-bot-api-key") === key;
};
const unauthorized = () => NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : (err as { message?: string })?.message || "Terjadi kesalahan";

/** "167663006" / "#167663006" / "OD000000167663006 (ID)" → "OD000000167663006" */
function normalizeOrder(raw: string): string {
  const v = cleanOrderId(raw).replace(/[#\s]/g, "");
  if (/^\d+$/.test(v)) return `OD${v.padStart(15, "0")}`;
  return v;
}

const NOTIFY_STATUSES = ["done", "failed", "finalize_failed", "cancelled"];

export async function GET(request: Request) {
  if (!isBot(request)) return unauthorized();
  const sp = new URL(request.url).searchParams;
  const mode = sp.get("mode") || "check";

  try {
    if (mode === "updates") {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data, error } = await supabaseAdmin
        .from("account_replacements")
        .select("id, order_id, kategori, old_username, new_username, status, error, ticket_channel_id, ticket_name, ticket_notified_status, updated_at")
        .not("ticket_channel_id", "is", null)
        .in("status", NOTIFY_STATUSES)
        .gte("updated_at", since)
        .order("updated_at", { ascending: true })
        .limit(20);
      if (error) throw error;

      const rows = (data || []).filter((r) => r.ticket_notified_status !== r.status);
      const doneUsers = rows.filter((r) => r.status === "done").map((r) => r.new_username);
      const pw = new Map<string, string | null>();
      if (doneUsers.length) {
        const { data: accs } = await supabaseAdmin.from("accounts_stock").select("username, password").in("username", doneUsers);
        (accs || []).forEach((a) => pw.set(a.username, a.password));
      }

      return NextResponse.json({
        success: true,
        data: rows.map((r) => ({
          id: r.id,
          order_id: r.order_id,
          kategori: r.kategori,
          old_username: r.old_username,
          new_username: r.new_username,
          new_password: r.status === "done" ? pw.get(r.new_username) || null : null,
          status: r.status,
          error: r.error,
          ticket_channel_id: r.ticket_channel_id,
          ticket_name: r.ticket_name,
        })),
      });
    }

    // ── mode=check ─────────────────────────────────────────────
    const orderId = normalizeOrder(sp.get("order_id") || "");
    const username = (sp.get("username") || "").trim();
    if (!/^OD\d{6,}$/.test(orderId)) {
      return NextResponse.json({ success: true, valid_format: false, order_id: orderId });
    }

    const [{ data: incomes }, { data: reps }] = await Promise.all([
      supabaseAdmin
        .from("income_log")
        .select("roblox_username, product_title, completed_at")
        .eq("order_id", orderId),
      supabaseAdmin
        .from("account_replacements")
        .select("old_username, new_username, status, done_at, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
    ]);

    const orderUsernames = (incomes || []).map((r) => r.roblox_username).filter((u): u is string => !!u);
    // Akun pengganti yang sudah dikirim juga dianggap bagian dari order
    (reps || []).forEach((r) => {
      if (r.status === "done" && r.new_username) orderUsernames.push(r.new_username);
    });

    let account: { username: string; kategori: string | null; added_by: string | null; logged_out: boolean | null; logged_out_at: string | null } | null = null;
    if (username) {
      const { data: acc } = await supabaseAdmin
        .from("accounts_stock")
        .select("username, kategori, added_by, logged_out, logged_out_at")
        .ilike("username", username.replace(/[%_]/g, (m) => `\\${m}`))
        .maybeSingle();
      account = acc || null;
    }

    const match = !!username && orderUsernames.some((u) => u.toLowerCase() === username.toLowerCase());
    const first = (incomes || [])[0];

    return NextResponse.json({
      success: true,
      valid_format: true,
      order_id: orderId,
      order_found: (incomes || []).length > 0,
      order_usernames: [...new Set(orderUsernames)],
      product_title: first?.product_title || null,
      sold_at: first?.completed_at || null,
      match,
      account,
      replacements: (reps || []).map((r) => ({
        old_username: r.old_username,
        new_username: r.new_username,
        status: r.status,
        done_at: r.done_at,
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
    const status = typeof body.status === "string" ? body.status : "";
    if (!Number.isFinite(id) || !NOTIFY_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, message: "id dan status wajib" }, { status: 400 });
    }
    const { error } = await supabaseAdmin.from("account_replacements").update({ ticket_notified_status: status }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: errorMessage(err) }, { status: 500 });
  }
}
