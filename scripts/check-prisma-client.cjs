// Verifikasi klien Prisma hasil generate: field banned & model Report harus ada.
// Ini persis properti yang hilang saat error 500 produksi
// ("Unknown field 'banned'" / "Cannot read properties of undefined (reading 'findMany')").
// Harus dijalankan DARI folder project (resolve @prisma/client project ini).
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const db = new PrismaClient();
const schemaCopy = fs.readFileSync("node_modules/.prisma/client/schema.prisma", "utf8");
const ok = {
  bannedField: schemaCopy.includes("banned"),
  banReasonField: schemaCopy.includes("banReason"),
  reportModel: typeof db.report?.findMany === "function",
  userFindMany: typeof db.user?.findMany === "function",
};
console.log("generated client check:", ok);
const pass = Object.values(ok).every(Boolean);
console.log(pass ? "PASS: client mengenal semua field/model baru" : "FAIL: client MASIH USANG");
process.exit(pass ? 0 : 1);
