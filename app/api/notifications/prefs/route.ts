// app/api/notifications/prefs/route.ts — pengaturan notifikasi user yang login
//   GET → { prefs: { muted_kinds, quiet_start, quiet_end }, kinds, devices }
//   PUT { muted_kinds, quiet_start, quiet_end }
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { KIND_LABEL, NOTIFY_KINDS } from "@/lib/notify";
import { EMAIL_RE, emailConfigured } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

export async function GET(req: NextRequest) {
  const s = getSession(req);
  if (!s?.username) return unauthorized();
  const me = s.username.toLowerCase();

  let { data: pref, error: pErr } = await supabaseAdmin
    .from("notification_prefs")
    .select("muted_kinds, quiet_start, quiet_end, email, email_penarikan")
    .eq("username", me)
    .maybeSingle();
  let emailSetupNeeded = false;
  if (pErr && /email/i.test(pErr.message)) {
    // SQL 013 belum dijalankan
    emailSetupNeeded = true;
    ({ data: pref, error: pErr } = await supabaseAdmin
      .from("notification_prefs")
      .select("muted_kinds, quiet_start, quiet_end")
      .eq("username", me)
      .maybeSingle());
  }

  let devices: Record<string, unknown>[] = [];
  const full = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, user_agent, created_at, last_used_at")
    .eq("username", me);
  if (full.error) {
    const basic = await supabaseAdmin.from("push_subscriptions").select("id, endpoint").eq("username", me);
    devices = basic.data || [];
  } else {
    devices = full.data || [];
  }

  return NextResponse.json({
    success: true,
    setup_needed: !!pErr,
    email_setup_needed: emailSetupNeeded,
    email_ready: emailConfigured(),
    prefs: { muted_kinds: [], quiet_start: null, quiet_end: null, email: null, email_penarikan: true, ...(pref || {}) },
    kinds: NOTIFY_KINDS.map((k) => ({ key: k, label: KIND_LABEL[k] })),
    devices,
  });
}

export async function PUT(req: NextRequest) {
  const s = getSession(req);
  if (!s?.username) return unauthorized();
  const b = await req.json().catch(() => ({}));
  const muted = (Array.isArray(b.muted_kinds) ? b.muted_kinds : []).filter((k: string) =>
    (NOTIFY_KINDS as readonly string[]).includes(k)
  );
  const qs = typeof b.quiet_start === "string" && HHMM.test(b.quiet_start) ? b.quiet_start : null;
  const qe = typeof b.quiet_end === "string" && HHMM.test(b.quiet_end) ? b.quiet_end : null;
  const row: Record<string, unknown> = {
    username: s.username.toLowerCase(),
    muted_kinds: muted,
    quiet_start: qs && qe ? qs : null,
    quiet_end: qs && qe ? qe : null,
    updated_at: new Date().toISOString(),
  };
  if ("email" in b) {
    const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    if (email && !EMAIL_RE.test(email)) {
      return NextResponse.json({ success: false, message: "Format email tidak valid" }, { status: 400 });
    }
    row.email = email || null;
  }
  if ("email_penarikan" in b) row.email_penarikan = b.email_penarikan !== false;

  const { error } = await supabaseAdmin.from("notification_prefs").upsert(row, { onConflict: "username" });
  if (error) {
    const setup = /notification_prefs|email/i.test(error.message);
    return NextResponse.json(
      { success: false, message: setup ? "Jalankan SQL 012_notifications.sql & 013_email_notif.sql dulu di Supabase" : error.message },
      { status: setup ? 503 : 500 }
    );
  }
  return NextResponse.json({ success: true });
}
