import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "Ukuran file maksimal 5 MB." }, { status: 400 });
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Format harus JPG, PNG, WebP, atau SVG." }, { status: 400 });
    }

    const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "svg";
    const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ url: `/uploads/${name}` });
  } catch (e) {
    console.error("upload error", e);
    return NextResponse.json({ error: "Gagal mengunggah file." }, { status: 500 });
  }
}
