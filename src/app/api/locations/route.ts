import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBaseFare } from "@/lib/settings";

export async function GET() {
  const [locations, baseFare] = await Promise.all([
    db.location.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    getBaseFare(),
  ]);
  return NextResponse.json({ locations, baseFare });
}
