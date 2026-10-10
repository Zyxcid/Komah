import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

// Unggah berkas (foto KTM, avatar) — multipart/form-data, field "file".
// Whitelist JPG/PNG/WebP, maks 5 MB, nama unik, disimpan di public/uploads.
// Di serverless (Vercel) filesystem read-only → berkas disematkan sebagai
// data URL di database (avatarUrl/ktmUrl) agar unggah tetap berfungsi.
const MAX_SIZE = 5 * 1024 * 1024;
// Batas ukuran data URL agar baris database tidak membengkak.
const MAX_EMBED = 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Berkas tidak ditemukan." }, { status: 400 });
    }
    const ext = ALLOWED[file.type];
    if (!ext) {
      return NextResponse.json({ error: "Format harus JPG, PNG, atau WebP." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Ukuran maksimal 5 MB." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());

    // Jalur normal: simpan ke public/uploads (dev lokal / server biasa).
    try {
      const dir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(dir, { recursive: true });
      const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
      await fs.writeFile(path.join(dir, name), buf);
      return NextResponse.json({ url: `/uploads/${name}` });
    } catch {
      // Filesystem read-only (mis. Vercel) → sematkan sebagai data URL.
      if (buf.length > MAX_EMBED) {
        return NextResponse.json(
          { error: "Server online hanya menerima foto sampai 1 MB — kecilkan dulu foto-mu, lalu unggah ulang." },
          { status: 400 }
        );
      }
      return NextResponse.json({ url: `data:${file.type};base64,${buf.toString("base64")}` });
    }
  } catch (e) {
    console.error("upload error", e);
    return NextResponse.json({ error: "Gagal mengunggah berkas." }, { status: 500 });
  }
}
