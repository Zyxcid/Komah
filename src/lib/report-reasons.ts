// Kategori laporan pelanggaran — dipakai bersama oleh UI (pilihan di dialog)
// dan API (validasi). Daftar tetap supaya laporan mudah ditindak admin.
export const REPORT_REASONS = [
  "Perilaku tidak sopan",
  "Meminta pembayaran di luar tarif",
  "Terlambat lama tanpa kabar",
  "Kendaraan tidak sesuai",
  "Barang / makanan rusak atau hilang",
  "Rute memutar",
  "Lainnya",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];
