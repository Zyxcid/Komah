import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import {
  registerLoginFailure,
  clearLoginFailures,
  loginLockedFor,
  loginAttemptsLeft,
} from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email dan kata sandi wajib diisi." }, { status: 400 });
    }

    // Anti brute force: kunci akun 15 menit setelah 5 kali gagal.
    const key = String(email).toLowerCase();
    const lockedFor = loginLockedFor(key);
    if (lockedFor !== null) {
      const minutes = Math.max(1, Math.ceil(lockedFor / 60));
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan gagal. Akun ini terkunci sementara — coba lagi dalam ${minutes} menit.`,
        },
        { status: 429, headers: { "Retry-After": String(lockedFor) } }
      );
    }

    const user = await db.user.findUnique({ where: { email: key } });
    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      registerLoginFailure(key);
      const left = loginAttemptsLeft(key);
      const hint =
        left <= 2 && left > 0 ? ` Sisa ${left} percobaan sebelum akun terkunci 15 menit.` : "";
      return NextResponse.json(
        { error: `Email atau kata sandi salah.${hint}` },
        { status: 401 }
      );
    }

    // Login sukses — hapus catatan kegagalan akun ini.
    clearLoginFailures(key);

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
