// app/api/auth/check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";



export async function GET(req: NextRequest) {
  try {
    const signedValue = req.cookies.get("auth_session")?.value;

    if (!signedValue) {
      return NextResponse.json({
        isAdmin: false,
        isLoggedIn: false,
        user: null,
      });
    }

    const session = verifySession(signedValue, process.env.AUTH_SECRET!);
    if (!session) {
      return NextResponse.json({
        isAdmin: false,
        isLoggedIn: false,
        user: null,
      });
    }

    const isAdmin = session.role === "superadmin";

    return NextResponse.json({
      isAdmin,
      isLoggedIn: true,
      user: {
        username: session.username,
        display_name: session.display_name,
        role: session.role,
      },
    });
  } catch {
    return NextResponse.json({
      isAdmin: false,
      isLoggedIn: false,
      user: null,
    });
  }
}