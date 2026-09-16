// app/api/auth/login/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const validUser = process.env.AUTH_USER;
    const validPass = process.env.AUTH_PASS;
    const secret = process.env.AUTH_SECRET;

    if (!validUser || !validPass || !secret) {
      return NextResponse.json(
        { message: "Server belum dikonfigurasi. Cek environment variables." },
        { status: 500 }
      );
    }

    if (username !== validUser || password !== validPass) {
      return NextResponse.json(
        { message: "Username atau password salah" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });

    // Set cookie session (7 hari)
    response.cookies.set("auth_session", secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 hari
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[Login API] error:", err);
    return NextResponse.json({ message: "Terjadi kesalahan" }, { status: 500 });
  }
}