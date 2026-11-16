#!/usr/bin/env node
// Memilih schema Prisma yang cocok dengan DATABASE_URL lalu (opsional)
// menjalankan perintah prisma terkait.
//
//   node scripts/select-schema.mjs              → prisma generate (SELALU)
//   node scripts/select-schema.mjs --push       → prisma db push --accept-data-loss
//   node scripts/select-schema.mjs --force-reset→ prisma db push --force-reset
//
// Aturannya sederhana:
//   DATABASE_URL diawali "file:"  → SQLite offline (prisma/schema.local.prisma)
//   selain itu (postgresql://… )  → PostgreSQL/Supabase (prisma/schema.prisma)
//
// Dipanggil otomatis oleh npm: postinstall, predev, prebuild, db:push, dst.
// Dipakai juga saat deploy Vercel (DATABASE_URL = Supabase → otomatis PostgreSQL).

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const PG_SCHEMA = "prisma/schema.prisma";
const SQLITE_SCHEMA = "prisma/schema.local.prisma";

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // npm tidak memuat .env — baca manual (cukup untuk satu baris DATABASE_URL=...).
  for (const f of [".env", ".env.local"]) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
    if (m) return m[1].trim();
  }
  return "";
}

const url = resolveDatabaseUrl();
const offline = url.startsWith("file:");
const schema = offline ? SQLITE_SCHEMA : PG_SCHEMA;
const want = offline ? "sqlite" : "postgresql";

if (!url) {
  console.warn("[db] DATABASE_URL belum diisi — memakai schema PostgreSQL (produksi).");
}

// --- Mode --push / --force-reset: langsung jalankan prisma db push ---
const arg = process.argv[2] || "";
if (arg === "--push" || arg === "--force-reset") {
  const flag = arg === "--push" ? "--accept-data-loss" : "--force-reset";
  console.log(`[db] ${want} (${schema}) → prisma db push ${flag}`);
  execSync(`npx prisma db push ${flag} --schema ${schema}`, { stdio: "inherit" });
  execSync(`npx prisma generate --schema ${schema}`, { stdio: "inherit" });
  process.exit(0);
}

// --- Mode default (generate): SELALU regenerasi client dari schema aktif ---
// Jangan pernah skip walau provider client sudah cocok: build Vercel bisa
// memulihkan node_modules lama dari cache (postinstall tidak jalan), dan
// client usang membuat field/model baru tak dikenal saat runtime
// (error 500 "Unknown field ..." / "Cannot read properties of undefined").
// prisma generate lokal cepat (~100 ms), jadi selalu jalankan saja.
console.log(`[db] generate client Prisma ${want} (${schema})`);
execSync(`npx prisma generate --schema ${schema}`, { stdio: "inherit" });
