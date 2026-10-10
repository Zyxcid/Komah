# KOMAH — Panduan Menjalankan, Notifikasi, dan Deploy

Aplikasi mendukung **dua mode database** yang dipilih otomatis dari isi
`DATABASE_URL` di `.env` (lihat `scripts/select-schema.mjs`):

| Mode | `DATABASE_URL` | Kapan dipakai |
|---|---|---|
| SQLite offline (default) | `file:../db/custom.db` | Development & coba-coba fitur, tanpa internet |
| PostgreSQL (Neon/Supabase) | `postgresql://...` | Deploy online di Vercel |

## Menjalankan lokal (3 langkah, offline)

```bash
cd komah
npm install
npm run dev
```

Buka http://localhost:3000. Database SQLite (`db/custom.db`) sudah termasuk
beserta data demo, dan `.env` (kunci database + VAPID notifikasi) juga sudah
disertakan sehingga semuanya langsung jalan tanpa setup apa pun.

Akun demo (sandi `komah123`): `penumpang@komah.id`, `driver@komah.id`,
`admin@komah.id`.

Perintah database (ikut mode yang aktif di `.env`):

```bash
npm run db:push    # buat/perbarui tabel sesuai schema
npm run db:seed    # isi ulang data demo
npm run db:reset   # hapus semua data lalu seed ulang
```

## Menguji notifikasi driver

Notifikasi pesanan baru punya dua lapis:

1. **Bunyi + getar** saat dashboard driver terbuka (deteksi lewat polling 4 detik).
2. **Web Push** (notifikasi sistem/layar) yang tetap masuk walau tab KOMAH ditutup.

Langkah uji di satu komputer:

1. Buka http://localhost:3000 di Chrome biasa, masuk sebagai `driver@komah.id`, buka mode driver.
2. Nyalakan toggle **Notifikasi pesanan** → klik **Izinkan** saat browser meminta izin.
3. Buka jendela **incognito** (atau browser lain), masuk sebagai `penumpang@komah.id`, lalu buat pesanan.
4. Di jendela driver: terdengar bunyi "ding-dong" dan pesanan langsung muncul.
5. **Uji tab tertutup:** tutup tab KOMAH di jendela driver (browser tetap berjalan), lalu buat pesanan lagi dari incognito. Notifikasi sistem akan muncul; klik notifikasi akan membuka dashboard driver.
6. Skrip uji cepat tanpa membuat pesanan: `node scripts/push-test.mjs`

Catatan platform:

- **Android Chrome:** notifikasi masuk seperti aplikasi biasa, bahkan setelah browser ditutup penuh.
- **iPhone (iOS 16.4+):** notifikasi hanya berfungsi setelah KOMAH dipasang ke layar utama (Bagikan → Tambah ke Layar Utama), lalu dibuka dari ikon tersebut.
- **Mode incognito** biasanya tidak bisa menerima push; pakai jendela biasa untuk peran driver.

## Kunci VAPID

Web Push membutuhkan sepasang kunci VAPID yang sudah diisi di `.env`:

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@komah.id
```

Ingin memakai kunci sendiri? Generate pasangan baru lalu salin ke `.env`:

```bash
npx web-push generate-vapid-keys
```

Ganti kunci akan membuat langganan lama tidak valid; cukup matikan lalu
nyalakan lagi toggle notifikasi di dashboard driver.

## Berpindah ke database Neon (saat mau deploy online)

1. Buat project gratis di https://neon.tech (bisa login pakai akun GitHub),
   pilih region terdekat (mis. Singapore `ap-southeast-1`).
2. Salin **Pooled connection string** dari Dashboard → Connection String:
   ```
   postgresql://user:password@ep-xxxxxx-pooler.ap-southeast-1.aws.neon.tech/komah?sslmode=require
   ```
3. Tempel ke `.env` sebagai `DATABASE_URL` (menggantikan baris `file:...`).
4. Buat semua tabel + isi data demo:
   ```bash
   npm run db:push
   npm run db:seed
   ```
   Perintah ini otomatis tahu sedang menunjuk Neon (bukan SQLite).

## Deploy ke Vercel

1. Push kode ke GitHub, lalu impor / redeploy project di Vercel.
2. Tambahkan environment variable di Settings → Environment Variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | connection string Neon (pooled) |
   | `VAPID_PUBLIC_KEY` | kunci publik VAPID (sama seperti di `.env` lokal) |
   | `VAPID_PRIVATE_KEY` | kunci privat VAPID |
   | `VAPID_SUBJECT` | `mailto:admin@komah.id` |
   | `AUTH_SECRET` | string acak panjang (lihat bawah) |

   (Tidak ada lagi `FONNTE_TOKEN` — notifikasi kini memakai Web Push gratis via VAPID.)

3. Generate `AUTH_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. Deploy ulang. Selesai — buka domain Vercel dan login dengan akun demo.

Verifikasi cepat setelah deploy:

- Login sebagai admin → data verifikasi driver tampil = koneksi Neon hidup.
- Buat pesanan dari HP kedua → notifikasi muncul di perangkat driver = Web Push produksi jalan.

## Catatan penting

1. **Jangan commit `.env`** ke GitHub — sudah di `.gitignore`. Simpan connection
   string dan kunci VAPID hanya di Vercel Environment Variables dan `.env` lokal.
2. **Upload file (foto KTM, avatar) belum persisten di Vercel** — route
   `/api/upload` menyimpan ke filesystem server yang bersifat sementara.
   Solusi gratis berikutnya: Vercel Blob (250 MB).
3. **Reset data demo** kapan pun: `npm run db:reset` (mode aktif mana pun).
4. Semua kode berjalan sama di SQLite dan PostgreSQL — perpindahan hanya
   mengganti `DATABASE_URL`, tidak perlu mengubah kode.
