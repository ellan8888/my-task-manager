// app/api/push/subscribe/route.ts — daftarkan / hapus perangkat penerima notifikasi (wajib login)
//   POST   { endpoint, keys: { p256dh, auth } }  → perangkat ini milik user yang login
//   DELETE { endpoint }                          → berhenti menerima notifikasi di perangkat ini
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session?.username) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const sub = await req.json().catch(() => null);
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ success: false, message: "Subscription invalid" }, { status: 400 });
  }
  const row: Record<string, unknown> = {
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    username: session.username.toLowerCase(),
    user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
  };
  let { error } = await supabaseAdmin.from("push_subscriptions").upsert(row, { onConflict: "endpoint" });
  if (error && /user_agent/i.test(error.message)) {
    // SQL 012 belum dijalankan → simpan tanpa info perangkat
    delete row.user_agent;
    ({ error } = await supabaseAdmin.from("push_subscriptions").upsert(row, { onConflict: "endpoint" }));
  }
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = getSession(req);
  if (!session?.username) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const { endpoint, id } = await req.json().catch(() => ({}));
  let q = supabaseAdmin.from("push_subscriptions").delete().eq("username", session.username.toLowerCase());
  if (id) q = q.eq("id", id);
  else if (endpoint) q = q.eq("endpoint", endpoint);
  else return NextResponse.json({ success: false, message: "endpoint / id wajib" }, { status: 400 });
  const { error } = await q;
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
