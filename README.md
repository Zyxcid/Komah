# KOMAH — Ojek & Antar Daring Civitas UNP

Aplikasi web bergaya **Gojek kampus** untuk warga Universitas Negeri Padang (UNP): pesan ojek penumpang, titip antar barang, dan pesan makanan kantin dengan **tarif transparan sejak awal** dan **pembayaran tunai saat tiba**. Driver adalah mahasiswa UNP terverifikasi KTM. Dilengkapi **peta OpenStreetMap** (pin jemput presisi + pelacakan posisi driver live) dan **notifikasi WhatsApp**.

Dibangun dengan **React 19 + Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui + Prisma (PostgreSQL)**. Seluruh komponen antarmuka adalah komponen React murni, dan API backend (autentikasi, pesanan, driver, admin) berjalan dalam satu kodebasis yang sama sehingga bisa langsung dijalankan lokal tanpa server terpisah. Untuk deploy online (Vercel + database gratis), ikuti panduan **[DEPLOY.md](DEPLOY.md)**.

---

## Prasyarat

| Kebutuhan | Versi minimum | Catatan |
|---|---|---|
| **Node.js** | v20.9 atau lebih baru | Cek dengan `node -v`. Pakai LTS terbaru (v20/v22) disarankan |
| **npm** | terpasang bersama Node.js | Bun/pnpm juga bisa, tapi contoh di panduan ini memakai npm |
| **Koneksi internet** | — | Diperlukan sekali saat `npm install`, dan saat dev/build pertama untuk mengunduh font Google (Plus Jakarta Sans) |

> 💡 Pengguna Windows: jalankan semua perintah di **PowerShell** atau **CMD** biasa — tidak perlu WSL.

---

## Cara Menjalankan (5 langkah)

```bash
# 1. Masuk ke folder proyek hasil ekstrak ZIP
cd komah

# 2. Pasang dependensi (postinstall otomatis menjalankan `prisma generate`)
npm install

# 3. Siapkan database — salin contoh env lalu isi DATABASE_URL
#    (PostgreSQL lokal, ATAU connection string gratis dari Neon — lihat DEPLOY.md)
cp .env.example .env

# 4. Buat tabel & isi data demo (20 lokasi UNP, driver, akun, riwayat pesanan)
npm run db:push
npm run db:seed

# 5. Jalankan server pengembangan
npm run dev
```

Buka **http://localhost:3000** di browser. Selesai!

> 💡 Tidak punya PostgreSQL terpasang? Cara termudah: buat database gratis di **[Neon](https://neon.tech)** (2 menit, tanpa kartu kredit), tempel connection string-nya ke `.env` — langkah detailnya ada di [DEPLOY.md](DEPLOY.md).

### Akun demo (sandi semuanya: `komah123`)

| Peran | Email | Fungsi saat login |
|---|---|---|
| Penumpang | `penumpang@komah.id` | Beranda → pesan ojek/barang/makanan, lacak pesanan, riwayat, profil |
| Driver | `driver@komah.id` | Dashboard driver: toggle online, pesanan masuk, terima/mulai/selesai |
| Admin | `admin@komah.id` | Panel verifikasi KTM calon driver (setujui/tolak) |

Di halaman Masuk juga tersedia tiga tombol pintas untuk ketiga akun demo di atas.

---

## Skrip yang Tersedia

```bash
npm run dev        # Server pengembangan di http://localhost:3000
npm run build      # Build produksi
npm start          # Jalankan hasil build produksi (port 3000)
npm run lint       # ESLint

npm run db:generate # Menghasilkan Prisma Client (otomatis juga saat npm install)
npm run db:push     # Sinkronkan skema tabel ke database (⚠️ perubahan skema bisa menghapus kolom terkait)
npm run db:seed     # Menanam ulang data demo (20 lokasi, driver, akun, dsb.)
npm run db:reset    # Hapus semua tabel + tanam ulang data demo (reset bersih)
```

**Mulai dari nol?** Cukup jalankan `npm run db:reset`.

---

## Fitur Aplikasi

**Untuk penumpang (role USER)**
- Pendaftaran dengan email, no. HP, dan NIM; login; profil yang bisa diedit (nama, telepon, avatar)
- Alamat sering dipakai (rumah/kos) tersimpan sebagai pintasan pesan
- Tiga layanan: **Ojek Penumpang**, **Antar Barang**, **Antar Makanan**
- Alur pesan ringkas: pilih layanan → titik jemput & tujuan (dengan pencarian lokasi UNP) → **atur pin di peta** → rincian tarif transparan → konfirmasi → tunggu driver
- **Peta live (OpenStreetMap)**: rute jalan otomatis (OSRM), posisi driver bergerak real-time, pratinjau peta sebelum memesan
- Lacak pesanan real-time: status, driver yang bertugas + tombol telepon, batalkan pesanan
- Rating bintang + ulasan setelah selesai; riwayat pesanan per tanggal; tombol "Pesan lagi"

**Untuk driver (role DRIVER)**
- Pendaftaran dengan upload KTM → menunggu verifikasi admin
- Toggle online/offline, pesanan masuk real-time, aksi terima/mulai/selesai, statistik pendapatan & perjalanan
- **Kirim posisi otomatis** saat ada pesanan aktif: GPS browser bila tersedia, atau mode simulasi (ditandai "Posisi demo") bila GPS tidak aktif — penumpang selalu melihat driver bergerak di peta

**Notifikasi WhatsApp** (via [Fonnte](https://fonnte.com))
- Pesanan baru → semua driver online; driver menerima/mulai/selesai → penumpang; driver baru mendaftar → admin; hasil verifikasi → driver
- Tanpa `FONNTE_TOKEN`, aplikasi tetap normal — pesan WA hanya dicetak ke log server (mode dev). Isi token di `.env` untuk pengiriman sungguhan

**Untuk admin (role ADMIN)**
- Panel verifikasi calon driver: pratinjau KTM, setujui atau tolak

**Tarif (zona, tampil di aplikasi sebelum pesan)**
- Dalam kampus UNP: flat **Rp6.000**
- Kampus ↔ luar (kos/area sekitar): tarif per lokasi (mis. Air Tawar Rp7.000, Kurao Rp9.000)
- Luar ↔ luar: tarif tertinggi + Rp1.000
- Pembayaran: **tunai langsung ke driver** saat tiba

---

## Struktur Proyek

```
komah/
├── prisma/
│   ├── schema.prisma          # Skema: User, Location, SavedAddress, Order
│   └── seed.ts                # Data demo: lokasi UNP, driver, akun, pesanan
├── public/
│   ├── logo.svg               # Logo KOMAH
│   └── uploads/               # Hasil upload KTM/avatar (via API)
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (font Plus Jakarta Sans)
│   │   ├── page.tsx           # Entry point SPA
│   │   ├── globals.css        # Tema Tailwind 4 + warna UNP (hijau/emas)
│   │   └── api/               # Backend (route handlers)
│   │       ├── auth/          # register, login, logout, me
│   │       ├── orders/        # CRUD pesanan + aksi status
│   │       ├── driver/        # dashboard & status driver
│   │       ├── admin/         # verifikasi driver
│   │       ├── profile/       # profil + alamat tersimpan
│   │       └── locations/, upload/, drivers/
│   ├── components/
│   │   ├── komah/             # Komponen aplikasi KOMAH
│   │   │   ├── welcome.tsx    # Gerbang masuk (Masuk/Daftar)
│   │   │   ├── auth-view.tsx  # Login & registrasi (+ upload KTM driver)
│   │   │   ├── shell.tsx      # Navigasi bawah (mobile) & atas (desktop)
│   │   │   ├── home-view.tsx  # Beranda: pesanan aktif, 3 layanan, pintasan
│   │   │   ├── order-flow.tsx # Alur pesan: layanan → rute → konfirmasi
│   │   │   ├── order-detail.tsx # Detail & lacak pesanan, peta live, rating
│   │   │   ├── map-core.tsx    # Peta Leaflet/OSM (pin, rute, marker driver)
│   │   │   ├── map-view.tsx    # Pembungkus peta (dynamic import, ssr:false)
│   │   │   ├── history-view.tsx, profile-view.tsx
│   │   │   ├── driver-dashboard.tsx, admin-view.tsx
│   │   │   ├── location-picker.tsx # Pemilih lokasi + estimasi tarif live
│   │   │   └── lib.tsx, bits.tsx   # Router hash & komponen kecil bersama
│   │   └── ui/                # Komponen shadcn/ui
│   ├── hooks/                 # use-mobile, use-toast
│   └── lib/                   # auth (scrypt+HMAC), session, fare (zona tarif),
│                               # db (Prisma client), wa (notifikasi WhatsApp),
│                               # types, utils
├── .env                       # DATABASE_URL (PostgreSQL — lihat .env.example)
├── package.json
└── next.config.ts, tsconfig.json, tailwind.config.ts, ...
```

---

## Catatan Teknis

- **Peta gratis tanpa API key**: [Leaflet](https://leafletjs.com) + tile [OpenStreetMap](https://www.openstreetmap.org) + rute jalan dari [OSRM demo server](https://router.project-osrm.org) — semuanya tanpa biaya dan tanpa kartu kredit. Jika server OSRM tidak terjangkau, peta otomatis beralih ke garis lurus antar titik.
- **Koordinat lokasi** di `prisma/seed.ts` adalah titik approx di sekitar kampus UNP Air Tawar untuk keperluan demo — presisikan langsung di file tersebut lalu `npm run db:reset`.
- **Notifikasi WhatsApp** memakai gateway [Fonnte](https://fonnte.com) (asal Indonesia, biaya sangat rendah). Atur `FONNTE_TOKEN` di `.env` untuk mengirim sungguhan; pesan dikirim *fire-and-forget* sehingga tidak memperlambat respons API.
- **Autentikasi tanpa layanan luar**: password di-hash dengan `scrypt`, sesi berupa cookie bertanda tangan HMAC — tidak butuh Auth0/Supabase.
- **Real-time ringan**: antarmuka memakai *polling* (4–8 detik) sehingga tidak memerlukan server WebSocket terpisah. Posisi driver dikirim tiap 8 detik dari dashboard driver (GPS browser; bila GPS tidak tersedia otomatis memakai simulasi yang ditandai "Posisi demo").
- **Font**: `Plus Jakarta Sans` dimuat via `next/font/google` — dev/build pertama membutuhkan koneksi internet; setelah ter-cache, bisa offline.
- **Upload file** (KTM/avatar) disimpan ke `public/uploads/` melalui `/api/upload` (maks 5 MB; JPG/PNG/WebP/SVG). Catatan: di serverless (Vercel) filesystem bersifat sementara — file upload bisa hilang; solusi persisten (Vercel Blob) dibahas di [DEPLOY.md](DEPLOY.md).

---

## Pertanyaan Umum / Troubleshooting

**Port 3000 sudah terpakai?**
Jalankan di port lain: `npm run dev -- -p 3001`.

**Error `@prisma/client did not initialize yet`?**
Jalankan `npm run db:generate` lalu mulai ulang `npm run dev`.

**Ingin mengubah/menambah lokasi UNP atau tarif?**
Edit daftar lokasi (beserta koordinat `lat`/`lng`) di `prisma/seed.ts`, lalu `npm run db:reset`. Tarif antar-zona dihitung otomatis di `src/lib/fare.ts`.

**Notifikasi WA tidak terkirim?**
Tanpa `FONNTE_TOKEN`, pesan hanya muncul di log server (cari `[WA-DEV]` di terminal `npm run dev`). Dengan token, pastikan nomor HP tersimpan dalam format Indonesia (08xx) dan nomor target sudah terdaftar di dashboard Fonnte.

**Gagal build karena unduhan font (offline)?**
Pastikan terhubung internet saat `npm run dev`/`build` pertama kali; Next.js akan meng-cache font setelahnya.

**Lupa sandi akun demo?**
Semua akun demo memakai `komah123`, atau reset seluruh data dengan `npm run db:reset`.

**Mau deploy ke internet (gratis)?**
Ikuti [DEPLOY.md](DEPLOY.md) — Vercel + database PostgreSQL gratis di Neon, tanpa kartu kredit.

**Mau pakai Bun?**
`bun install && bun run dev` juga berfungsi (proyek ini awalnya dikembangkan dengan Bun).
