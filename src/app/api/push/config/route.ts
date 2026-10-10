import { NextResponse } from "next/server";

// Kunci publik VAPID untuk langganan push di browser driver.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
}
