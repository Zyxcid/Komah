// ===================== Notifikasi WhatsApp (KOMAH) =====================
// Mengirim pesan WA via Fonnte (https://fonnte.com) — penyedia gateway WA
// asal Indonesia berbiaya rendah. Tanpa token (mode pengembangan), pesan
// hanya dicetak ke log server sehingga alur tetap bisa diuji lokal.

const FONNTE_TOKEN = process.env.FONNTE_TOKEN;

/** Normalkan nomor HP Indonesia ke format 62xxx yang diminta Fonnte. */
function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/[^0-9]/g, "");
  const withCountry = digits.startsWith("62") ? digits : digits.replace(/^0/, "62");
  return withCountry.length >= 10 && withCountry.length <= 15 ? withCountry : null;
}

/**
 * Kirim WA tanpa memblokir request utama (fire-and-forget).
 * Selalu aman dipanggil: nomor kosong/invalid dilewati diam-diam.
 */
export function sendWA(phone: string | null | undefined, message: string) {
  if (!phone || !message.trim()) return;
  const target = normalizePhone(phone);
  if (!target) return;

  if (!FONNTE_TOKEN) {
    // Mode pengembangan: tidak ada token → tampilkan di log server saja.
    console.log(`[WA-DEV] → ${target}\n${message}\n`);
    return;
  }

  fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: FONNTE_TOKEN },
    body: JSON.stringify({ target, message }),
  }).catch((e) => console.error("Gagal mengirim WA:", e?.message || e));
}

const TYPE_LABEL: Record<string, string> = {
  OJEK: "Ojek Penumpang",
  BARANG: "Antar Barang",
  MAKANAN: "Antar Makanan",
};

export function rupiahWA(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

/** Pesan ke driver online: ada pesanan baru masuk. */
export function waNewOrderForDriver(o: {
  code: string;
  type: string;
  pickupName: string;
  destName: string;
  fare: number;
}) {
  return [
    "[KOMAH] Pesanan baru masuk!",
    `${TYPE_LABEL[o.type] || o.type} • ${o.pickupName} → ${o.destName}`,
    `Tarif ${rupiahWA(o.fare)} (tunai) • Kode: ${o.code}`,
    "Buka aplikasi KOMAH untuk menerima pesanan.",
  ].join("\n");
}

/** Pesan ke penumpang: pesanan diterima driver. */
export function waOrderAccepted(o: {
  code: string;
  driverName: string;
  vehicle: string | null;
  pickupName: string;
  fare: number;
}) {
  return [
    "[KOMAH] Driver ditemukan!",
    `${o.driverName} (${o.vehicle || "sepeda motor"}) sedang menuju titik jemputmu di ${o.pickupName}.`,
    `Kode pesanan: ${o.code} • Tarif ${rupiahWA(o.fare)} dibayar tunai.`,
    "Pantau posisi driver di aplikasi KOMAH.",
  ].join("\n");
}

/** Pesan ke penumpang: perjalanan dimulai. */
export function waOrderStarted(o: { code: string; destName: string; fare: number }) {
  return [
    "[KOMAH] Perjalanan dimulai",
    `${o.code}: driver sedang mengantarmu ke ${o.destName}.`,
    `Tarif ${rupiahWA(o.fare)} dibayar tunai di akhir perjalanan.`,
  ].join("\n");
}

/** Pesan ke penumpang: pesanan selesai. */
export function waOrderCompleted(o: { code: string; fare: number }) {
  return [
    "[KOMAH] Pesanan selesai, terima kasih!",
    `${o.code} • Tarif ${rupiahWA(o.fare)} (tunai).`,
    "Beri rating drivemu di aplikasi KOMAH ya.",
  ].join("\n");
}

/** Pesan ke driver terkait: pesanan dibatalkan penumpang. */
export function waOrderCancelled(o: { code: string }) {
  return [`[KOMAH] Pesanan ${o.code} dibatalkan penumpang.`, "Maaf atas kendalanya, cek pesanan lain di aplikasi."].join("\n");
}

/** Pesan ke admin: ada driver baru mendaftar. */
export function waDriverRegistered(d: { name: string; vehicle: string | null }) {
  return [
    "[KOMAH] Driver baru mendaftar",
    `${d.name} (${d.vehicle || "-"}) menunggu verifikasi KTM.`,
    "Buka panel verifikasi di aplikasi untuk memproses.",
  ].join("\n");
}

/** Pesan ke driver: hasil verifikasi. */
export function waVerificationResult(d: { name: string; approved: boolean }) {
  return d.approved
    ? ["[KOMAH] Verifikasi disetujui!", `Selamat ${d.name}, akun driver-mu sudah aktif.`, "Aktifkan mode Online dan mulai terima pesanan!"].join("\n")
    : ["[KOMAH] Verifikasi ditolak", `Maaf ${d.name}, pendaftaran driver-mu belum disetujui admin.`, "Hubungi tim KOMAH untuk info lebih lanjut."].join("\n");
}
