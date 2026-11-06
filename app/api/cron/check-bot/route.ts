// app/api/cron/check-bot/route.ts — dipanggil cron (header Authorization: Bearer CRON_SECRET)
//
// Memakai lib/botStatus (tabel bot_status, sama dengan tampilan web).
// Satu notifikasi per kejadian:
//   • Bot Offline   — heartbeat berhenti > 5 menit
//   • Bot Macet     — bot hidup tapi loop utama berhenti > 15 menit
//   • Pengingat     — kalau masih bermasalah, diingatkan lagi tiap 2 jam
//   • Kembali Online — begitu normal lagi, lengkap dengan lama gangguan
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notify } from "@/lib/notify";
import { BOT_NAME, getBotStatus, humanDuration, wibTime } from "@/lib/botStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOTIF_TARGET = "ellan";
const REMIND_EVERY_MIN = 120;

type Incident = { id: number; kind: string | null; sent_at: string; started_at: string | null; recovered_at: string | null };

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const s = await getBotStatus();

  // Kejadian terakhir yang belum pulih
  const { data: open, error: openErr } = await supabaseAdmin
    .from("bot_offline_notifications")
    .select("id, kind, sent_at, started_at, recovered_at")
    .eq("bot_name", BOT_NAME)
    .is("recovered_at", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle<Incident>();

  if (openErr) {
    // SQL 014 belum dijalankan → kabari tanpa riwayat kejadian, maksimal sekali per 30 menit
    console.error("[Check Bot] Jalankan sql/014_bot_monitor.sql:", openErr.message);
    if (s.state === "offline" || s.state === "stuck") {
      const { data: last } = await supabaseAdmin
        .from("bot_offline_notifications")
        .select("sent_at")
        .eq("bot_name", BOT_NAME)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!last || Date.now() - new Date(last.sent_at).getTime() > 30 * 60000) {
        const age = (s.state === "offline" ? s.heartbeatAgeSec : s.loopAgeSec) || 0;
        await supabaseAdmin.from("bot_offline_notifications").insert({ bot_name: BOT_NAME, sent_at: new Date().toISOString(), diff_seconds: age });
        await notify({
          to: NOTIF_TARGET,
          title: s.state === "offline" ? "Bot Offline!" : "Bot Macet!",
          body: `Bot itemku bermasalah sejak ${humanDuration(age)} lalu.`,
          url: "/",
          kind: "bot",
        });
      }
    }
    return NextResponse.json({ success: true, state: s.state, setup_needed: true });
  }

  // ── Normal ──────────────────────────────────────────────────
  if (s.state === "online" || s.state === "unknown") {
    if (open && s.state === "online") {
      const since = open.started_at || open.sent_at;
      const downSec = (Date.now() - new Date(since).getTime()) / 1000;
      await supabaseAdmin.from("bot_offline_notifications").update({ recovered_at: new Date().toISOString() }).eq("id", open.id);
      await notify({
        to: NOTIF_TARGET,
        title: "Bot kembali online",
        body: `Bot itemku normal lagi setelah ${open.kind === "stuck" ? "macet" : "offline"} sekitar ${humanDuration(downSec)}.`,
        url: "/",
        kind: "bot",
      });
      return NextResponse.json({ success: true, state: s.state, recovered: true });
    }
    return NextResponse.json({ success: true, state: s.state });
  }

  // ── Bermasalah (offline / macet) ───────────────────────────
  const problemSince =
    s.state === "offline"
      ? new Date(new Date(s.lastHeartbeat!).getTime()).toISOString()
      : new Date(new Date(s.lastLoopAt!).getTime()).toISOString();
  const ageSec = s.state === "offline" ? s.heartbeatAgeSec! : s.loopAgeSec!;

  const title = s.state === "offline" ? "Bot Offline!" : "Bot Macet!";
  const body =
    s.state === "offline"
      ? `Bot itemku tidak mengirim kabar sejak ${wibTime(problemSince)} (${humanDuration(ageSec)} lalu). Cek PC / koneksi.`
      : `Bot itemku masih hidup, tapi loop utama berhenti sejak ${wibTime(problemSince)} (${humanDuration(ageSec)} lalu).`;

  if (open) {
    const minsSince = (Date.now() - new Date(open.sent_at).getTime()) / 60000;
    const kindChanged = (open.kind || "offline") !== s.state;
    if (!kindChanged && minsSince < REMIND_EVERY_MIN) {
      return NextResponse.json({ success: true, state: s.state, message: "Sudah dikabari — menunggu pulih" });
    }
    // Pengingat / berubah jenis: perbarui kejadian yang sama
    await supabaseAdmin
      .from("bot_offline_notifications")
      .update({ sent_at: new Date().toISOString(), kind: s.state, diff_seconds: ageSec })
      .eq("id", open.id);
    await notify({ to: NOTIF_TARGET, title: kindChanged ? title : `${title} (masih)`, body, url: "/", kind: "bot" });
    return NextResponse.json({ success: true, state: s.state, reminded: true });
  }

  await supabaseAdmin.from("bot_offline_notifications").insert({
    bot_name: BOT_NAME,
    kind: s.state,
    started_at: problemSince,
    sent_at: new Date().toISOString(),
    diff_seconds: ageSec,
  });
  await notify({ to: NOTIF_TARGET, title, body, url: "/", kind: "bot" });
  return NextResponse.json({ success: true, state: s.state, notified: true });
}
