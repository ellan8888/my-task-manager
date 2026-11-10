// app/api/remove-account/route.ts — tutup akun di RAM (dilindungi middleware: login atau kunci bot)
import { NextResponse } from "next/server";
import { removeFromRam } from "@/lib/ram";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) {
    return NextResponse.json({ success: false, message: "Username diperlukan" }, { status: 400 });
  }
  const r = await removeFromRam(username);
  return NextResponse.json(r, { status: r.success ? 200 : r.status >= 400 ? r.status : 500 });
}
