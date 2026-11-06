// lib/botStatus.ts — satu sumber kebenaran status bot itemku (login_once.py)
//
// Data: tabel bot_status (diisi /api/bot/heartbeat tiap 60 detik)
//   last_heartbeat      → proses bot masih hidup
//   metadata.last_loop_at → kapan LOOP UTAMA terakhir berputar (bot bisa hidup tapi macet)
//
// Status:
//   online  : heartbeat baru & loop utama berputar normal
//   stuck   : heartbeat masih ada tapi loop utama berhenti > STUCK_AFTER_SEC (macet)
//   offline : tidak ada heartbeat > OFFLINE_AFTER_SEC
//   unknown : belum pernah mengirim heartbeat
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const BOT_NAME = "itemku-bot";
export const OFFLINE_AFTER_SEC = 5 * 60;
export const STUCK_AFTER_SEC = 15 * 60;

export type BotState = "online" | "stuck" | "offline" | "unknown";

export type BotStatus = {
  state: BotState;
  isOnline: boolean;
  lastHeartbeat: string | null;
  lastLoopAt: string | null;
  heartbeatAgeSec: number | null;
  loopAgeSec: number | null;
  startedAt: string | null;
  message: string | null;
};

/** 59223 menit → "41 hari"; 75 → "1 jam 15 menit" */
export function humanDuration(sec: number) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} detik`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} jam ${m % 60} menit` : `${h} jam`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} hari ${h % 24} jam` : `${d} hari`;
}

export function wibTime(iso: string | Date) {
  return new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) + " WIB";
}

export async function getBotStatus(): Promise<BotStatus> {
  const { data } = await supabaseAdmin
    .from("bot_status")
    .select("last_heartbeat, metadata, message")
    .eq("bot_name", BOT_NAME)
    .maybeSingle();

  if (!data?.last_heartbeat) {
    return { state: "unknown", isOnline: false, lastHeartbeat: null, lastLoopAt: null, heartbeatAgeSec: null, loopAgeSec: null, startedAt: null, message: null };
  }
  const now = Date.now();
  const meta = (data.metadata || {}) as { last_loop_at?: string; started_at?: string };
  const hbAge = Math.floor((now - new Date(data.last_heartbeat).getTime()) / 1000);
  const loopAge = meta.last_loop_at ? Math.floor((now - new Date(meta.last_loop_at).getTime()) / 1000) : null;

  let state: BotState = "online";
  if (hbAge > OFFLINE_AFTER_SEC) state = "offline";
  else if (loopAge !== null && loopAge > STUCK_AFTER_SEC) state = "stuck";

  return {
    state,
    isOnline: state === "online",
    lastHeartbeat: data.last_heartbeat,
    lastLoopAt: meta.last_loop_at || null,
    heartbeatAgeSec: hbAge,
    loopAgeSec: loopAge,
    startedAt: meta.started_at || null,
    message: data.message || null,
  };
}
