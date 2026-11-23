// app/api/chat/media/route.ts — buka foto/video chat (bucket privat chat-media)
//   GET ?p=<path>  → 302 ke signed URL berumur pendek
//   Hanya staff yang boleh melihat percakapan itu (aturan sama dengan isi chat).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { canSeeConversation } from "@/lib/chat";
import { convOfPath, safePath, signedUrl } from "@/lib/chatMedia";

export const dynamic = "force-dynamic";

const TTL = 3600;

export async function GET(req: Request) {
  const session = getSession(req);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const path = safePath(new URL(req.url).searchParams.get("p"));
  if (!path) return new NextResponse("Not found", { status: 404 });

  const { data: c } = await supabaseAdmin
    .from("chat_conversations")
    .select("owner")
    .eq("conversation_id", convOfPath(path))
    .maybeSingle();
  if (!c || !canSeeConversation(session, c.owner)) return new NextResponse("Not found", { status: 404 });

  const url = await signedUrl(path, TTL);
  if (!url) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: url,
      // browser boleh memakai ulang pengalihan ini sebentar (signed URL berlaku 1 jam)
      "Cache-Control": "private, max-age=1800",
    },
  });
}
