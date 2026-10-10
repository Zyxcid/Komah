# KOMAH — Ojek & Antar Daring Civitas UNP

Aplikasi web bergaya **Gojek kampus** untuk warga Universitas Negeri Padang (UNP): pesan ojek penumpang, titip antar barang, dan pesan makanan kantin dengan **tarif transparan sejak awal** dan **pembayaran tunai saat tiba**. Driver adalah mahasiswa UNP terverifikasi KTM. Dilengkapi **peta OpenStreetMap** (pin jemput presisi + pelacakan posisi driver live) dan **notifikasi push**.

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

## Cara Menjalankan (2 langkah, offline)

```bash
# 1. Masuk ke folder proyek hasil ekstrak ZIP
cd komah

# 2. Pasang dependensi lalu jalankan
npm install
npm run dev
```

Buka **http://localhost:3000** di browser. Selesai!

> 📦 `.env` beserta database demo (`db/custom.db`, mode SQLite offline) sudah
> termasuk di ZIP — tanpa setup apa pun, tanpa internet setelah `npm install`.
>
> 💡 Ingin langsung memakai PostgreSQL/Neon (mis. untuk deploy)? Ganti
> `DATABASE_URL` di `.env` dengan connection string dari
> **[Neon](https://neon.tech)** lalu `npm run db:push` — langkah detailnya di
> [DEPLOY.md](DEPLOY.md). Mode database dipilih otomatis dari isi `DATABASE_URL`.

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
- **Notifikasi pesanan baru (Web Push)**: bunyi "ding-dong" + getar saat dashboard terbuka, dan notifikasi sistem/layar yang tetap masuk walau tab/aplikasi KOMAH ditutup — toggle "Notifikasi pesanan" di dashboard driver (panduan uji: [DEPLOY.md](DEPLOY.md))

**Notifikasi push untuk semua peran** (Web Push — tanpa gateway WhatsApp, gratis)
- Pesanan baru → semua driver online; driver menerima/mulai/selesai → penumpang; driver baru mendaftar → admin; hasil verifikasi → driver
- Penumpang menyalakannya dari kartu **Notifikasi Pesanan** di halaman Profil; driver dari toggle **Notifikasi pesanan** di dashboard (plus bunyi "ding-dong" saat terbuka). Tanpa kunci VAPID di `.env`, pesan hanya dicetak ke log server (mode dev)
- Chat penumpang ↔ driver tetap langsung lewat tautan WhatsApp (wa.me) di halaman pesanan — tanpa gateway, tanpa biaya

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
│   ├── schema.prisma          # Skema PostgreSQL (produksi): User, Location,
│   │                          # SavedAddress, Order, Setting, PushSubscription
│   ├── schema.local.prisma    # Varian SQLite (dev offline) — dipilih otomatis
│   └── seed.ts                # Data demo: lokasi UNP, driver, akun, pesanan
├── public/
│   ├── logo.svg               # Logo KOMAH
│   ├── sw.js                  # Service worker: cache shell + Web Push driver
│   ├── manifest.webmanifest   # Manifest PWA (Tambah ke Layar Utama)
│   └── uploads/               # Hasil upload KTM/avatar (via API)
├── scripts/
│   ├── select-schema.mjs      # Pilih SQLite/PostgreSQL otomatis dari .env
│   └── push-test.mjs          # Uji kirim Web Push tanpa membuat pesanan
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
│   │       ├── push/          # langganan Web Push (config/subscribe/unsubscribe)
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
│   │   │   ├── push.ts        # Helper Web Push klien (langganan + bunyi)
│   │   │   ├── push-toggle.tsx # Kartu toggle notifikasi di halaman Profil
│   │   │   └── lib.tsx, bits.tsx   # Router hash & komponen kecil bersama
│   │   └── ui/                # Komponen shadcn/ui
│   ├── hooks/                 # use-mobile, use-toast
│   └── lib/                   # auth (scrypt+HMAC), session, fare (zona tarif),
│                               # db (Prisma client),
│                               # push (pengirim Web Push sisi server),
│                               # types, utils
├── db/custom.db               # Database SQLite demo (dev offline)
├── .env                       # DATABASE_URL + kunci VAPID (siap pakai)
├── package.json
└── next.config.ts, tsconfig.json, tailwind.config.ts, ...
```

---

## Catatan Teknis

- **Peta gratis tanpa API key**: [Leaflet](https://leafletjs.com) + tile [OpenStreetMap](https://www.openstreetmap.org) + rute jalan dari [OSRM demo server](https://router.project-osrm.org) — semuanya tanpa biaya dan tanpa kartu kredit. Jika server OSRM tidak terjangkau, peta otomatis beralih ke garis lurus antar titik.
- **Koordinat lokasi** di `prisma/seed.ts` adalah titik approx di sekitar kampus UNP Air Tawar untuk keperluan demo — presisikan langsung di file tersebut lalu `npm run db:reset`.
- **Notifikasi push (menggantikan gateway WhatsApp)**: memakai standar Web Push + VAPID (tanpa layanan berbayar). Driver berlangganan lewat toggle di dashboard, penumpang lewat kartu Notifikasi Pesanan di Profil — keduanya lewat service worker (`public/sw.js`); server mengirim lewat `src/lib/push.ts` saat pesanan dibuat/diupdate. Langganan kadaluarsa otomatis dibersihkan. Di Android Chrome notifikasi masuk seperti aplikasi biasa walau browser ditutup; di iPhone butuh iOS 16.4+ dan KOMAH dipasang ke layar utama (PWA).
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

**Notifikasi push tidak muncul?**
1. Pastikan toggle notifikasi menyala (driver: di dashboard; penumpang: kartu Notifikasi Pesanan di Profil) dan izin notifikasi browser diizinkan (ikon kunci di address bar).
2. Jalankan `node scripts/push-test.mjs` untuk uji kirim tanpa membuat pesanan.
3. Cek `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` terisi di `.env` (atau di Vercel Environment Variables bila versi deploy).
4. iPhone: pasang dulu KOMAH ke layar utama (Bagikan → Tambah ke Layar Utama), iOS 16.4+.
5. Mode incognito tidak bisa menerima push — pakai jendela biasa untuk driver.

**Berganti database SQLite ↔ Neon?**
Cukup ganti `DATABASE_URL` di `.env` — `scripts/select-schema.mjs` memilih schema yang tepat otomatis saat `npm run dev` / `db:push`. Tidak ada kode yang perlu diubah.

**Gagal build karena unduhan font (offline)?**
Pastikan terhubung internet saat `npm run dev`/`build` pertama kali; Next.js akan meng-cache font setelahnya.

**Lupa sandi akun demo?**
Semua akun demo memakai `komah123`, atau reset seluruh data dengan `npm run db:reset`.

**Mau deploy ke internet (gratis)?**
Ikuti [DEPLOY.md](DEPLOY.md) — Vercel + database PostgreSQL gratis di Neon, tanpa kartu kredit.

**Mau pakai Bun?**
`bun install && bun run dev` juga berfungsi (proyek ini awalnya dikembangkan dengan Bun).
