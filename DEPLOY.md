# Panduan Deploy KOMAH — Vercel + Database Online Gratis

Aplikasi ini memakai **Prisma + PostgreSQL**. File database SQLite lama
tidak bisa dipakai di Vercel (filesystem serverless bersifat sementara —
data & file upload akan hilang), jadi kita pakai database hosting gratis.

Rekomendasi: **Neon** (neon.tech) — PostgreSQL gratis, serverless, dan
integrasi resmi dengan Vercel. Alternatif yang sama langkahnya:
**Supabase** (supabase.com).

---

## Langkah 1 — Buat database gratis di Neon

1. Buka https://neon.tech → **Sign Up** (bisa pakai akun GitHub).
2. Buat project baru, misal bernama `komah` (pilih region terdekat,
   mis. Singapore `ap-southeast-1`).
3. Setelah project dibuat, buka **Dashboard → Connection String**.
4. Salin **Pooled connection string** — bentuknya seperti:

   ```
   postgresql://user:password@ep-xxxxxx-pooler.ap-southeast-1.aws.neon.tech/komah?sslmode=require
   ```

   > Yang berakhiran **`-pooler`** (WebSockets/pooler) lebih cocok untuk
   > serverless Vercel — koneksi dipool, tidak boros koneksi paralel.

## Langkah 2 — Set environment variable di Vercel

1. Buka https://vercel.com → project **Komah** → **Settings →
   Environment Variables**.
2. Tambahkan:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | connection string Neon dari Langkah 1 |
   | `AUTH_SECRET` | string acak panjang (lihat catatan di bawah) |

3. Generate `AUTH_SECRET` di terminal:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   > Tanpa `AUTH_SECRET`, aplikasi memakai default dev — sesi login bisa
   > dipalsukan siapa saja yang tahu secret-nya. Wajib diganti di produksi.

## Langkah 3 — Buat tabel & isi data awal (seed)

Dijalankan **sekali saja**, dari komputer lokal (repo sudah ter-clone):

```bash
# 1. Pastikan .env lokal berisi DATABASE_URL Neon (salin dari .env.example)
#    DATABASE_URL="postgresql://...neon.tech/komah?sslmode=require"

npm install

# 2. Buat semua tabel di database Neon
npx prisma db push

# 3. Isi data demo (akun, lokasi UNP, pesanan contoh)
npm run db:seed
```

Akun demo setelah seed:

| Peran | Email | Password |
|---|---|---|
| Penumpang | penumpang@komah.id | komah123 |
| Driver | driver@komah.id | komah123 |
| Admin | admin@komah.id | komah123 |

## Langkah 4 — Deploy ulang

```bash
git add -A
git commit -m "switch ke PostgreSQL + env deploy"
git push
```

Push ke GitHub memicu deploy otomatis di Vercel. Selesai — buka
https://komah.vercel.app dan login dengan akun demo di atas.

---

## Verifikasi cepat

- Login sebagai admin → data verifikasi driver tampil = koneksi DB hidup.
- Buat pesanan → refresh halaman → pesanan masih ada = data tersimpan
  permanen (bukan lagi di file sementara).

## Catatan penting

1. **Jangan commit `.env`** ke GitHub — sudah di `.gitignore`. Simpan
   connection string hanya di Vercel Environment Variables dan `.env`
   lokal.
2. **Upload file (foto KTM, avatar) belum persisten di Vercel.**
   Route `/api/upload` menyimpan file ke filesystem server — di Vercel
   file ini hilang saat function di-restart. Solusi gratis: **Vercel Blob**
   (250 MB gratis) — migrasi bisa dikerjakan sebagai task berikutnya.
3. **Tidak perlu mengubah kode lain** — seluruh query sudah lewat Prisma;
   perpindahan SQLite → PostgreSQL hanya mengubah `provider` di
   `prisma/schema.prisma` (sudah diterapkan di repo ini) dan
   `DATABASE_URL`.
4. Jika lupa password akun demo atau ingin reset data: jalankan ulang
   `npm run db:seed` (menghapus semua data lama lalu menanam ulang).
