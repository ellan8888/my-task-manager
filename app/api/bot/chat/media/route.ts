// app/api/bot/chat/media/route.ts — bot menyalin foto/video chat Itemku ke penyimpanan My Task
//   POST ?c=<conversation_id>&tt=<timetoken>&i=<urutan>&name=<nama asli>   body = isi file, header x-bot-api-key
//   → { file: { path, name, mime, size } }
// Alasan: link file PubNub membawa kunci akses akun dan kedaluwarsa ±3 jam — salinan ini yang ditampilkan.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isBotRequest } from "@/lib/auth";
import { CHAT_BUCKET, EXT, IN_MAX_BYTES, sniffMime, validConv } from "@/lib/chatMedia";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isBotRequest(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const conv = String(sp.get("c") || "");
  const tt = String(sp.get("tt") || "").replace(/\D/g, "").slice(0, 20);
  const idx = Math.max(0, Math.min(9, Number(sp.get("i")) || 0));
  const name = String(sp.get("name") || "").replace(/[^\w.\- ]/g, "").slice(0, 80);
  if (!validConv(conv) || tt.length < 13) {
    return NextResponse.json({ success: false, message: "Percakapan / timetoken tidak valid" }, { status: 400 });
  }
  if (Number(req.headers.get("content-length") || 0) > IN_MAX_BYTES) {
    return NextResponse.json({ success: false, message: "File terlalu besar" }, { status: 413 });
  }
  const buf = new Uint8Array(await req.arrayBuffer());
  if (!buf.length || buf.length > IN_MAX_BYTES) {
    return NextResponse.json({ success: false, message: "File kosong / terlalu besar" }, { status: 413 });
  }
  const mime = sniffMime(buf) || "application/octet-stream";
  const ext = EXT[mime] || "bin";
  const path = `in/${conv}/${tt}-${idx}.${ext}`;
  // upsert: bot bisa mengirim ulang file yang sama (mis. setelah web sempat gagal menyimpan pesan)
  const { error } = await supabaseAdmin.storage.from(CHAT_BUCKET).upload(path, buf, { contentType: mime, upsert: true });
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, file: { path, name: name || path.split("/").pop(), mime, size: buf.length } });
}
