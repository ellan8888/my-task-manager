// app/api/notifications/email-test/route.ts — kirim email tes ke alamat email user yang login
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { EMAIL_RE, emailConfigured, renderEmail, sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const s = getSession(req);
  if (!s?.username) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!emailConfigured()) {
    return NextResponse.json({ success: false, message: "Pengirim email belum diatur di server (SMTP_USER / SMTP_PASS)" }, { status: 503 });
  }
  const { data } = await supabaseAdmin
    .from("notification_prefs")
    .select("email")
    .eq("username", s.username.toLowerCase())
    .maybeSingle();
  const email = data?.email as string | undefined;
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ success: false, message: "Simpan alamat email kamu dulu" }, { status: 400 });
  }
  const { html, text } = renderEmail({
    tone: "violet",
    badge: "Email tes",
    title: "Email notifikasi sudah aktif",
    intro: `Halo ${s.display_name || s.username}, email ini menandakan notifikasi penarikan saldo akan dikirim ke alamat ini.`,
    rows: [
      ["Akun My Task", s.username],
      ["Dikirim ke", email],
    ],
    buttonText: "Buka pengaturan notifikasi",
    path: "/admin/notifikasi",
  });
  const r = await sendEmail(email, "Tes email notifikasi My Task Manager", html, text);
  if (!r.ok) return NextResponse.json({ success: false, message: `Gagal mengirim: ${r.error}` }, { status: 502 });
  return NextResponse.json({ success: true, message: `Email tes terkirim ke ${email}` });
}
