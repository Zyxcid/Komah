import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { sendWA, waVerificationResult } from "@/lib/wa";

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
  // Kabari driver via WA mengenai hasil verifikasi.
  sendWA(driver.phone, waVerificationResult({ name: driver.name, approved: decision === "approve" }));
  return NextResponse.json({
    ok: true,
    message: decision === "approve" ? "Driver diverifikasi & dapat mulai menerima pesanan." : "Pendaftaran driver ditolak.",
  });
}
