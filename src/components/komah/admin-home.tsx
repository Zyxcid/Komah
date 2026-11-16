"use client";

// Beranda admin — hero section berisi ringkasan cepat + pintasan utama:
// verifikasi driver, kelola driver (blokir/pengawasan), monitor pesanan,
// dan kelola lokasi. Semua panel dibuka lewat kartu di sini.

import { ChevronRight, ClipboardList, Flag, MapPinned, ReceiptText, ShieldCheck, Users } from "lucide-react";
import { navigate, useApi, useAuth } from "./lib";

interface HomeStats {
  pending: Array<{ id: string }>;
  verifiedCount: number;
}

interface DriversStats {
  drivers: Array<{ isOnline: boolean; banned: boolean }>;
}

interface ReportsStats {
  openCount: number;
}

export function AdminHomeView() {
  const { me } = useAuth();
  const { data: verifData } = useApi<HomeStats>("/api/admin/verifications", { interval: 15000 });
  const { data: locData } = useApi<{ locations: unknown[] }>("/api/admin/locations", { interval: 30000 });
  const { data: drvData } = useApi<DriversStats>("/api/admin/drivers", { interval: 15000 });
  const { data: repData } = useApi<ReportsStats>("/api/admin/reports", { interval: 15000 });

  const pendingCount = verifData?.pending?.length ?? 0;
  const locationCount = locData?.locations?.length ?? 0;
  const drivers = drvData?.drivers || [];
  const onlineCount = drivers.filter((d) => d.isOnline && !d.banned).length;
  const bannedCount = drivers.filter((d) => d.banned).length;
  const openReports = repData?.openCount ?? 0;

  const hour = new Date().getHours();
  const greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-10 pt-6 sm:px-6">
      {/* Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-gold to-gold-dark p-6 text-unp-deep shadow-lg shadow-gold/30">
        <div className="flex items-center gap-4">
          <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-white/25 backdrop-blur">
            <ShieldCheck size={26} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-unp-deep/70">{greet}, {me?.name}</p>
            <h1 className="text-xl font-extrabold leading-tight sm:text-2xl">Panel Admin KOMAH</h1>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-white/25 px-3.5 py-3 backdrop-blur">
            <p className="text-[11px] font-bold uppercase tracking-wider text-unp-deep/60">Menunggu acc</p>
            <p className="mt-0.5 text-2xl font-extrabold text-unp-deep">{pendingCount}</p>
          </div>
          <div className="rounded-2xl bg-white/25 px-3.5 py-3 backdrop-blur">
            <p className="text-[11px] font-bold uppercase tracking-wider text-unp-deep/60">Driver online</p>
            <p className="mt-0.5 text-2xl font-extrabold">{onlineCount}</p>
          </div>
          <div className="rounded-2xl bg-white/25 px-3.5 py-3 backdrop-blur">
            <p className="text-[11px] font-bold uppercase tracking-wider text-unp-deep/60">Diblokir</p>
            <p className="mt-0.5 text-2xl font-extrabold">{bannedCount}</p>
          </div>
          <div className="rounded-2xl bg-white/25 px-3.5 py-3 backdrop-blur">
            <p className="text-[11px] font-bold uppercase tracking-wider text-unp-deep/60">Titik lokasi</p>
            <p className="mt-0.5 text-2xl font-extrabold">{locationCount}</p>
          </div>
        </div>
      </div>

      {/* Pintasan panel — diklik langsung dari sini */}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <button
          onClick={() => navigate("/verifikasi")}
          className="group relative overflow-hidden rounded-3xl border-2 border-gold/50 bg-gradient-to-br from-gold-soft/60 to-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          {pendingCount > 0 && (
            <span className="absolute right-4 top-4 flex h-7 min-w-7 items-center justify-center rounded-full bg-gold px-2 text-xs font-extrabold text-unp-deep shadow-md">
              {pendingCount}
            </span>
          )}
          <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold-dark text-unp-deep shadow-md">
            <ClipboardList size={24} />
          </span>
          <p className="mt-3.5 text-base font-extrabold">Verifikasi Driver</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            Periksa KTM pendaftar driver baru dan setujui atau tolak.
          </p>
          <p className="mt-3 flex items-center gap-1 text-xs font-bold text-unp">
            Buka panel <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </p>
        </button>

        <button
          onClick={() => navigate("/kelola-driver")}
          className="group relative overflow-hidden rounded-3xl border-2 border-unp/30 bg-gradient-to-br from-unp-soft/60 to-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          {bannedCount > 0 && (
            <span className="absolute right-4 top-4 flex h-7 min-w-7 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-extrabold text-white shadow-md">
              {bannedCount}
            </span>
          )}
          <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold-dark text-unp-deep shadow-md">
            <Users size={24} />
          </span>
          <p className="mt-3.5 text-base font-extrabold">Kelola Driver</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            Daftar driver, rating, statistik, dan blokir driver pelanggar.
          </p>
          <p className="mt-3 flex items-center gap-1 text-xs font-bold text-unp">
            Buka panel <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </p>
        </button>

        <button
          onClick={() => navigate("/monitor-pesanan")}
          className="group overflow-hidden rounded-3xl border-2 border-unp/30 bg-gradient-to-br from-unp-soft/60 to-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold-dark text-unp-deep shadow-md">
            <ReceiptText size={24} />
          </span>
          <p className="mt-3.5 text-base font-extrabold">Monitor Pesanan</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            Pantau pesanan berjalan & riwayat; batalkan pesanan bermasalah.
          </p>
          <p className="mt-3 flex items-center gap-1 text-xs font-bold text-unp">
            Buka panel <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </p>
        </button>

        <button
          onClick={() => navigate("/laporan")}
          className="group relative overflow-hidden rounded-3xl border-2 border-unp/30 bg-gradient-to-br from-unp-soft/60 to-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          {openReports > 0 && (
            <span className="absolute right-4 top-4 flex h-7 min-w-7 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-extrabold text-white shadow-md">
              {openReports}
            </span>
          )}
          <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold-dark text-unp-deep shadow-md">
            <Flag size={24} />
          </span>
          <p className="mt-3.5 text-base font-extrabold">Laporan</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            Laporan pelanggaran pengguna — blokir driver atau tutup laporan.
          </p>
          <p className="mt-3 flex items-center gap-1 text-xs font-bold text-unp">
            Buka panel <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </p>
        </button>

        <button
          onClick={() => navigate("/kelola-lokasi")}
          className="group overflow-hidden rounded-3xl border-2 border-unp/30 bg-gradient-to-br from-unp-soft/60 to-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold-dark text-unp-deep shadow-md">
            <MapPinned size={24} />
          </span>
          <p className="mt-3.5 text-base font-extrabold">Kelola Lokasi</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            Tambah titik baru, atur nama &amp; koordinat peta untuk rute penumpang.
          </p>
          <p className="mt-3 flex items-center gap-1 text-xs font-bold text-unp">
            Buka panel <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </p>
        </button>
      </div>
    </div>
  );
}
