import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email dan kata sandi wajib diisi." }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      return NextResponse.json({ error: "Email atau kata sandi salah." }, { status: 401 });
    }

    // Apakah driver sedang mengantar? (menentukan halaman pembuka & kunci mode)
    const activeDrive = await db.order.findFirst({
      where: { driverId: user.id, status: { in: ["DIKONFIRMASI", "BERJALAN"] } },
      select: { id: true },
    });

    const token = signSession({ uid: user.id, role: user.role, exp: Date.now() + SESSION_MAX_AGE * 1000 });
    const res = NextResponse.json({
      ok: true,
      role: user.role,
      appMode: user.appMode === "DRIVER" ? "DRIVER" : "PENUMPANG",
      activeDrive: !!activeDrive,
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    return res;
  } catch (e) {
    console.error("login error", e);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
