import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { msgVerificationResult, sendPushToUser } from "@/lib/push";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  }
  const pending = await db.user.findMany({
    where: { role: "DRIVER", verifyStatus: "PENDING" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      nim: true,
      vehiclePlate: true,
      vehicleType: true,
      ktmUrl: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const verifiedCount = await db.user.count({ where: { role: "DRIVER", verifyStatus: "VERIFIED" } });
  return NextResponse.json({ pending, verifiedCount });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  }
  const { driverId, decision } = await req.json();
  if (!driverId || !["approve", "reject"].includes(decision)) {
    return NextResponse.json({ error: "Parameter tidak valid." }, { status: 400 });
  }
  const driver = await db.user.findUnique({ where: { id: driverId } });
  if (!driver || driver.role !== "DRIVER" || driver.verifyStatus !== "PENDING") {
    return NextResponse.json({ error: "Driver tidak ditemukan / sudah diproses." }, { status: 404 });
  }
  await db.user.update({
    where: { id: driverId },
    data: { verifyStatus: decision === "approve" ? "VERIFIED" : "REJECTED" },
  });
  // Kabari driver via push mengenai hasil verifikasi (sampai walau aplikasi ditutup).
  await sendPushToUser(
    driver.id,
    msgVerificationResult({ name: driver.name, approved: decision === "approve" })
  ).catch(() => {});
  return NextResponse.json({
    ok: true,
    message: decision === "approve" ? "Driver diverifikasi & dapat mulai menerima pesanan." : "Pendaftaran driver ditolak.",
  });
}
