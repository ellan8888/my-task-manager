// app/api/bot/phonebox-rf/route.ts — dashboard HP (PhoneBox, widget Custom HTML) mengosongkan HP Redfinger dari order.
//   POST { order_id, rf_slot }  header x-device-token (token perangkat, izin 'rf_release' — lihat sql/034)
//   Hanya mengosongkan kalau order itu MEMANG sedang memakai HP rf_slot (tidak bisa memasang / memindah HP).
//   Dipanggil dari iframe ber-sandbox (origin "null") → CORS terbuka, tapi tanpa token tidak bisa apa-apa.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeOrder } from "@/lib/chat";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-device-token",
  "Access-Control-Max-Age": "86400",
};
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: CORS });

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const token = req.headers.get("x-device-token") || "";
  if (token.length < 20) return reply({ success: false, message: "Unauthorized" }, 401);
  const { data: dev } = await supabaseAdmin
    .from("device_tokens")
    .select("id, name, scopes, revoked_at")
    .eq("token_hash", await sha256(token))
    .maybeSingle();
  if (!dev || dev.revoked_at || !(dev.scopes || []).includes("rf_release")) {
    return reply({ success: false, message: "Unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const orderId = normalizeOrder(body.order_id);
  const slot = Number(body.rf_slot);
  if (!orderId || !Number.isInteger(slot) || slot <= 0) return reply({ success: false, message: "order / HP tidak valid" }, 400);

  const { data: order } = await supabaseAdmin
    .from("joki_orders")
    .select("order_id, rf_slot")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!order) return reply({ success: false, message: "Order tidak ditemukan" }, 404);
  if (order.rf_slot !== slot) {
    return reply({ success: true, already: true, message: `Order ini sudah tidak memakai HP ${slot}` });
  }
  const { error } = await supabaseAdmin
    .from("joki_orders")
    .update({ rf_slot: null })
    .eq("order_id", orderId)
    .eq("rf_slot", slot);
  if (error) return reply({ success: false, message: error.message }, 500);
  await supabaseAdmin.from("device_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", dev.id);
  console.log(`[phonebox-rf] ${dev.name}: HP ${slot} dikosongkan dari ${orderId}`);
  return reply({ success: true });
}
