# KOMAH — Panduan Uji Coba Pilot

Pilot: **Senin, 9 November 2026** — 1 fakultas (target milestone: 45
pesanan/hari), menyusul rollout penuh civitas UNP pada 7 Desember 2026 sesuai
rencana 14 minggu.

Dokumen ini berisi checklist kesiapan, skenario uji, langkah onboarding
driver, monitoring, dan kriteria sukses. Pendamping: [README.md](README.md)
(fitur & menjalankan lokal) dan [DEPLOY.md](DEPLOY.md) (deploy, database
Supabase, notifikasi).

## 1. Checklist kesiapan (per 4 November 2026)

| # | Item | Status |
|---|---|---|
| 1 | Kode final tergabung di branch utama GitHub — rate-limit login, error boundary, higiene push saat logout, halaman akun demo, penyempurnaan UI | ✅ Selesai |
| 2 | Deployment produksi aktif: Vercel + Supabase (komah.vercel.app) | ✅ Selesai |
| 3 | Build produksi lolos tanpa error | ✅ Selesai (4 Nov) |
| 4 | Dokumentasi deploy & README selaras dengan stack produksi (Supabase) | ✅ Selesai (4 Nov) |
| 5 | Notifikasi sisi driver terverifikasi di perangkat nyata (2 perangkat) | ✅ Selesai (28 Okt) |
| 6 | Notifikasi sisi penumpang terverifikasi di perangkat nyata | ⏳ Dijadwalkan 7 Nov |
| 7 | Gladi bersih skenario uji S1–S6 bersama tim | ⏳ Dijadwalkan 8 Nov |
| 8 | Akun uji & panduan singkat dibagikan ke peserta | ⏳ Sebelum 8 Nov |

## 2. Peserta & peran

- **Admin / pengawas**: Syahid (akun `admin@komah.id`) — memonitor verifikasi
  KTM, lokasi jemput/antar, dan gangguan selama pilot.
- **Driver pilot** (5 orang pertama): mulai dari akun demo `driver@komah.id`
  ditambah calon driver nyata yang mendaftar sendiri (alur pendaftaran +
  verifikasi KTM ikut teruji — lihat S1).
- **Penumpang**: mahasiswa & staf fakultas sasaran, memakai akun masing-masing.

Akun demo (sandi `komah123`): `penumpang@komah.id`, `driver@komah.id`,
`admin@komah.id` — daftar lengkap di README.

## 3. Skenario uji

| Kode | Skenario | Kriteria lolos |
|---|---|---|
| S1 | Pendaftaran + verifikasi KTM: calon driver mendaftar, mengunggah KTM (≤ 1 MB saat online), admin menyetujui | Akun berstatus driver; notifikasi "Verifikasi disetujui" diterima pendaftar |
| S2 | Pesanan ojek lengkap: penumpang memesan, driver online menerima, penumpang menutup aplikasi | Notifikasi "Pesanan baru" tiba di driver walau aplikasinya tertutup; penumpang menerima "Driver ditemukan", "Perjalanan dimulai", "Perjalanan selesai" |
| S3 | Pesanan delivery barang: rute 2 tahap + detail barang | Alur dan tarif barang benar; status berakhir SELESAI dan masuk riwayat |
| S4 | Pembatalan pesanan sebelum driver ditemukan | Pesanan batal rapi; notifikasi "Pesanan dibatalkan" diterima pihak terkait; driver/pesanan kembali ke kondisi semula |
| S5 | Notifikasi lintas perangkat: HP driver + HP penumpang yang berbeda | Kedua sisi menerima notifikasi sesuai tahap; mengeklik notifikasi membuka halaman yang tepat |
| S6 | Keamanan dasar: 5 kali input sandi salah | Akun terkunci 15 menit dengan pesan yang jelas (proteksi brute-force) |

## 4. Onboarding driver (± 5 menit)

1. Buka komah.vercel.app → login → pilih mode **Driver**.
2. Nyalakan toggle **Notifikasi pesanan** → ketuk **Izinkan** saat browser bertanya.
3. iPhone (iOS 16.4+): Bagikan → **Tambah ke Layar Utama**, lalu selalu buka
   KOMAH dari ikon tersebut.
4. Uji cepat: minta seorang penumpang membuat pesanan — pastikan bunyi dan
   notifikasi masuk.

## 5. Monitoring selama pilot

- Harian: cek daftar pesanan (admin), log Vercel bila muncul error 5xx, dan
  grup WhatsApp peserta.
- Gangguan berat: koordinasi order manual lewat grup WA sementara perbaikan
  dikerjakan.
- Setiap keluhan pengguna dicatat (tangkapan layar bila memungkinkan) untuk
  evaluasi.

## 6. Kriteria sukses pilot

- Seluruh skenario S1–S6 lolos saat gladi bersih (8 Nov).
- Tidak ada bug kritis yang menghentikan pesanan di hari pertama.
- Notifikasi tiba di kedua sisi pada ≥ 95% pesanan.
- ≥ 45 pesanan/hari di akhir minggu pertama (target milestone).
- Evaluasi hasil & keputusan lanjut/tunda rollout: **12 November 2026**.

## 7. Catatan teknis ringan

- Data demo lokal bisa direset kapan pun: `npm run db:reset` (jangan dipakai
  di database produksi Supabase selama pilot berjalan).
- Jangan bagikan sandi akun demo secara publik — proteksi brute-force
  mengunci akun 15 menit setelah 5 kali gagal.
- Foto KTM di produksi maksimal 1 MB (disematkan sebagai data URL); kecilkan
  ukuran foto bila ditolak.
