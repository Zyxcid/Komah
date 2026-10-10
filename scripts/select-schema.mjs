#!/usr/bin/env node
// Memilih schema Prisma yang cocok dengan DATABASE_URL lalu (opsional)
// menjalankan perintah prisma terkait.
//
//   node scripts/select-schema.mjs              → prisma generate (bila perlu)
//   node scripts/select-schema.mjs --push       → prisma db push --accept-data-loss
//   node scripts/select-schema.mjs --force-reset→ prisma db push --force-reset
//
// Aturannya sederhana:
//   DATABASE_URL diawali "file:"  → SQLite offline (prisma/schema.local.prisma)
//   selain itu (postgresql://… )  → PostgreSQL/Neon (prisma/schema.prisma)
//
// Dipanggil otomatis oleh npm: postinstall, predev, prebuild, db:push, dst.
// Dipakai juga saat deploy Vercel (DATABASE_URL = Neon → otomatis PostgreSQL).

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const PG_SCHEMA = "prisma/schema.prisma";
const SQLITE_SCHEMA = "prisma/schema.local.prisma";
const GENERATED = "node_modules/.prisma/client/schema.prisma";

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

function currentGeneratedProvider() {
  try {
    const s = fs.readFileSync(path.join(root, GENERATED), "utf8");
    return s.match(/provider\s*=\s*"(\w+)"/)?.[1] || null;
  } catch {
    return null;
  }
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

// --- Mode default (generate): hanya regenerasi bila provider client berubah ---
if (currentGeneratedProvider() === want) {
  console.log(`[db] client Prisma sudah ${want} — siap.`);
  process.exit(0);
}

console.log(`[db] aktifkan client Prisma ${want} (${schema})`);
execSync(`npx prisma generate --schema ${schema}`, { stdio: "inherit" });
