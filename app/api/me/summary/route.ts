// app/api/me/summary/route.ts — angka badge di menu (task terbuka & jokian aktif) untuk user yang login.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const u = s.username;
  const [total, done, joki] = await Promise.all([
    supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).eq("username", u),
    supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).eq("username", u).eq("completed", true),
    supabaseAdmin.from("joki_orders").select("id", { count: "exact", head: true }).eq("joki_name", u).eq("completed", false),
  ]);
  return NextResponse.json({
    success: true,
    tasksTotal: total.count ?? 0,
    tasksDone: done.count ?? 0,
    joki: joki.count ?? 0,
  });
}
