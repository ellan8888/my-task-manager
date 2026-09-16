// app/api/auth/check/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get("auth_session")?.value;
  const isAdmin = session === process.env.AUTH_SECRET;

  return NextResponse.json({ isAdmin });
}