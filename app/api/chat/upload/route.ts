// app/api/chat/upload/route.ts — staff mengunggah foto untuk dikirim ke pembeli Itemku
//   POST ?c=<conversation_id>   body = isi file (sudah dikecilkan di browser), Content-Type image/*
//   → { file: { path, name, mime, size } }   lalu dikirim lewat /api/chat/send { files: [file] }
// Jenis file dicek dari isinya (bukan nama). Hanya foto: JPG, PNG, WebP, GIF.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { canSeeConversation } from "@/lib/chat";
import { CHAT_BUCKET, EXT, OUT_MAX_BYTES, outName, sniffMime, validConv } from "@/lib/chatMedia";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: Request) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const conv = String(new URL(req.url).searchParams.get("c") || "");
  if (!validConv(conv)) return NextResponse.json({ success: false, message: "Percakapan tidak valid" }, { status: 400 });

  const len = Number(req.headers.get("content-length") || 0);
  if (len > OUT_MAX_BYTES) return tooBig();

  const { data: c } = await supabaseAdmin.from("chat_conversations").select("owner").eq("conversation_id", conv).maybeSingle();
  if (!c || !canSeeConversation(session, c.owner)) {
    return NextResponse.json({ success: false, message: "Percakapan tidak ditemukan" }, { status: 404 });
  }

  const buf = new Uint8Array(await req.arrayBuffer());
  if (!buf.length) return NextResponse.json({ success: false, message: "File kosong" }, { status: 400 });
  if (buf.length > OUT_MAX_BYTES) return tooBig();
  const mime = sniffMime(buf);
  if (!mime || !ALLOWED.has(mime)) {
    return NextResponse.json({ success: false, message: "Hanya foto JPG, PNG, WebP, atau GIF" }, { status: 415 });
  }

  const name = outName(EXT[mime]);
  const path = `out/${conv}/${name}`;
  const { error } = await supabaseAdmin.storage.from(CHAT_BUCKET).upload(path, buf, { contentType: mime, upsert: false });
  if (error) return NextResponse.json({ success: false, message: `Gagal menyimpan foto: ${error.message}` }, { status: 500 });
  return NextResponse.json({ success: true, file: { path, name, mime, size: buf.length } });
}

function tooBig() {
  return NextResponse.json(
    { success: false, message: `Foto terlalu besar (maks. ${OUT_MAX_BYTES / 1024 / 1024} MB)` },
    { status: 413 },
  );
}
