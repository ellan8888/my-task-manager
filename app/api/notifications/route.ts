// app/api/notifications/route.ts — riwayat notifikasi user yang login (ikon lonceng)
//   GET   ?limit=30&before=<id>   → { data, unread }
//   PATCH { ids?: number[], all?: true } → tandai dibaca
//   DELETE { all?: true, ids?: number[] } → hapus dari riwayat
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
const missing = (msg: string) => /notifications/i.test(msg);

export async function GET(req: NextRequest) {
  const s = getSession(req);
  if (!s?.username) return unauthorized();
  const me = s.username.toLowerCase();
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 30));
  const before = Number(sp.get("before")) || null;

  let q = supabaseAdmin
    .from("notifications")
    .select("id, kind, title, body, url, read_at, created_at")
    .eq("username", me)
    .order("id", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("id", before);
  const { data, error } = await q;
  if (error) {
    if (missing(error.message)) return NextResponse.json({ success: true, data: [], unread: 0, setup_needed: true });
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
  const { count } = await supabaseAdmin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("username", me)
    .is("read_at", null);
  return NextResponse.json({ success: true, data: data || [], unread: count || 0 });
}

export async function PATCH(req: NextRequest) {
  const s = getSession(req);
  if (!s?.username) return unauthorized();
  const { ids, all } = await req.json().catch(() => ({}));
  let q = supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("username", s.username.toLowerCase())
    .is("read_at", null);
  if (!all) {
    const list = (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isFinite);
    if (!list.length) return NextResponse.json({ success: false, message: "ids wajib" }, { status: 400 });
    q = q.in("id", list);
  }
  const { error } = await q;
  if (error && !missing(error.message)) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const s = getSession(req);
  if (!s?.username) return unauthorized();
  const { ids, all } = await req.json().catch(() => ({}));
  let q = supabaseAdmin.from("notifications").delete().eq("username", s.username.toLowerCase());
  if (!all) {
    const list = (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isFinite);
    if (!list.length) return NextResponse.json({ success: false, message: "ids wajib" }, { status: 400 });
    q = q.in("id", list);
  }
  const { error } = await q;
  if (error && !missing(error.message)) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
