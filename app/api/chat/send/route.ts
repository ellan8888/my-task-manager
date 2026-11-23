// app/api/chat/send/route.ts — staff membalas chat pembeli Itemku dari My Task
//   POST { conversation_id, text?, files?: [{path,name,mime,size}] } → masuk antrean (chat_outbox);
//        login_once yang mengirim ke Itemku. Tiap foto jadi satu baris antrean (dikirim berurutan),
//        teks (keterangan) menyusul sebagai pesan terakhir. Foto diunggah dulu lewat /api/chat/upload.
//   POST { conversation_id, retry_id } → kirim lagi balasan yang sudah Gagal (setelah semua percobaan otomatis)
//   Boleh membalas = boleh melihat: pemilik order, atau semua staff kalau ordernya belum diketahui.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { canSeeConversation, chatUser } from "@/lib/chat";
import { CHAT_BUCKET, safePath, type ChatFile } from "@/lib/chatMedia";

export const dynamic = "force-dynamic";

const MAX_LEN = 2000;
const MAX_WAITING = 12;         // balasan menunggu per percakapan (cegah kirim beruntun tidak sengaja)
const MAX_FILES = 6;            // foto per kiriman

export async function POST(req: Request) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const conv = String(body.conversation_id || "").slice(0, 120);
  const text = String(body.text || "").replace(/\r/g, "").trim();
  const retryId = Number(body.retry_id);
  if (conv && Number.isSafeInteger(retryId) && retryId > 0) return retry(session, conv, retryId);
  const rawFiles: unknown[] = Array.isArray(body.files) ? body.files.slice(0, MAX_FILES + 1) : [];
  if (rawFiles.length > MAX_FILES) {
    return NextResponse.json({ success: false, message: `Maksimal ${MAX_FILES} foto sekali kirim` }, { status: 400 });
  }
  const files: ChatFile[] = [];
  for (const f of rawFiles) {
    const o = (f || {}) as Record<string, unknown>;
    const path = safePath(o.path);
    // hanya foto yang diunggah ke percakapan INI
    if (!path || !path.startsWith(`out/${conv}/`)) {
      return NextResponse.json({ success: false, message: "Foto tidak valid, unggah ulang" }, { status: 400 });
    }
    files.push({ path, name: path.split("/").pop()!, mime: String(o.mime || "image/jpeg").slice(0, 40), size: Number(o.size) || 0 });
  }
  if (!conv || (!text && !files.length)) return NextResponse.json({ success: false, message: "Tulis pesannya dulu" }, { status: 400 });
  if (text.length > MAX_LEN) {
    return NextResponse.json({ success: false, message: `Pesan terlalu panjang (maks. ${MAX_LEN} huruf)` }, { status: 400 });
  }

  const { data: c } = await supabaseAdmin
    .from("chat_conversations")
    .select("conversation_id, owner")
    .eq("conversation_id", conv)
    .maybeSingle();
  if (!c || !canSeeConversation(session, c.owner)) {
    return NextResponse.json({ success: false, message: "Percakapan tidak ditemukan" }, { status: 404 });
  }

  const { count } = await supabaseAdmin
    .from("chat_outbox")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conv)
    .in("status", ["pending", "sending"]);
  if ((count || 0) + files.length + (text ? 1 : 0) > MAX_WAITING) {
    return NextResponse.json(
      { success: false, message: "Masih ada beberapa balasan yang belum terkirim — tunggu sebentar" },
      { status: 429 },
    );
  }

  // foto benar-benar ada di penyimpanan (bot tidak boleh mencoba file yang tidak ada selamanya)
  if (files.length) {
    const { data: listed } = await supabaseAdmin.storage.from(CHAT_BUCKET).list(`out/${conv}`, { limit: 1000 });
    const have = new Set((listed || []).map((x) => x.name));
    if (files.some((f) => !have.has(f.name))) {
      return NextResponse.json({ success: false, message: "Foto belum selesai terunggah, coba lagi" }, { status: 400 });
    }
  }

  const by = chatUser(session);
  const rows = [
    ...files.map((f) => ({ conversation_id: conv, text: "", files: [f], created_by: by })),
    ...(text ? [{ conversation_id: conv, text, files: [], created_by: by }] : []),
  ];
  // satu per satu supaya created_at berurutan (bot mengirim sesuai urutan ini)
  const items = [];
  for (const row of rows) {
    const { data, error } = await supabaseAdmin.from("chat_outbox").insert(row).select(OUT_COLS).single();
    if (error) return NextResponse.json({ success: false, message: error.message, items }, { status: 500 });
    items.push(data);
  }
  return NextResponse.json({ success: true, item: items[items.length - 1], items });
}

const OUT_COLS = "id, conversation_id, text, files, status, method, error, timetoken, created_by, created_at, attempts";

/** Kirim lagi balasan yang gagal: kembali ke antrean dengan percobaan baru (teks sama, tidak perlu ditulis ulang). */
async function retry(session: NonNullable<ReturnType<typeof getSession>>, conv: string, id: number) {
  const { data: c } = await supabaseAdmin
    .from("chat_conversations")
    .select("owner")
    .eq("conversation_id", conv)
    .maybeSingle();
  if (!c || !canSeeConversation(session, c.owner)) {
    return NextResponse.json({ success: false, message: "Percakapan tidak ditemukan" }, { status: 404 });
  }
  const { data, error } = await supabaseAdmin
    .from("chat_outbox")
    .update({ status: "pending", attempts: 1, next_try_at: null, error: null, claimed_at: null, done_at: null,
              created_at: new Date().toISOString() })        // dihitung baru supaya tidak langsung kedaluwarsa
    .eq("id", id)
    .eq("conversation_id", conv)
    .eq("status", "failed")
    .select(OUT_COLS)
    .maybeSingle();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ success: false, message: "Balasan ini sudah tidak bisa dikirim lagi" }, { status: 409 });
  return NextResponse.json({ success: true, item: data });
}
