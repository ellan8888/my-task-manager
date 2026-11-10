// app/api/tasks/route.ts — tugas pribadi (Home). Semua aksi hanya untuk task milik user yang login.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const EDITABLE = ["title", "deadline", "reminder", "reminder_sent", "reminder_last_sent", "priority", "category", "notes", "completed"] as const;

function pick(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) out[k] = body[k];
  return out;
}

const unauthorized = () => NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
const fail = (message: string, status = 500) => NextResponse.json({ success: false, message }, { status });

export async function GET(req: NextRequest) {
  const s = getSession(req);
  if (!s) return unauthorized();
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .eq("username", s.username)
    .order("created_at", { ascending: false });
  if (error) return fail(error.message);
  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const s = getSession(req);
  if (!s) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const row: Record<string, unknown> = { ...pick(body), id: Number(body.id) || Date.now(), username: s.username };
  if (!row.title || !row.deadline || !row.priority) return fail("Judul, deadline, dan prioritas wajib", 400);
  const { data, error } = await supabaseAdmin.from("tasks").insert(row).select().single();
  if (error) return fail(error.message);
  return NextResponse.json({ success: true, data });
}

export async function PATCH(req: NextRequest) {
  const s = getSession(req);
  if (!s) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  const changes = pick(body);
  if (!id || Object.keys(changes).length === 0) return fail("id dan perubahan wajib", 400);
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .update(changes)
    .eq("id", id)
    .eq("username", s.username)
    .select();
  if (error) return fail(error.message);
  if (!data?.length) return fail("Task tidak ditemukan", 404);
  return NextResponse.json({ success: true, data: data[0] });
}

export async function DELETE(req: NextRequest) {
  const s = getSession(req);
  if (!s) return unauthorized();
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return fail("id wajib", 400);
  const { error, count } = await supabaseAdmin
    .from("tasks")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("username", s.username);
  if (error) return fail(error.message);
  if (!count) return fail("Task tidak ditemukan", 404);
  return NextResponse.json({ success: true });
}
