"use client";

import {
  BadgeCheck,
  ChevronRight,
  ClipboardList,
  MapPinned,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { navigate, rupiah, useApi, useAuth } from "./lib";
import { UserAvatar } from "./bits";
import type { LocationT } from "@/lib/types";

interface PendingDriver {
  id: string;
  name: string;
  vehicleType: string;
  vehiclePlate: string;
}

interface VerifyData {
  pending: PendingDriver[];
  verifiedCount: number;
}

export function AdminHomeView() {
  const { me } = useAuth();
  const { data: verifyData } = useApi<VerifyData>("/api/admin/verifications");
  const { data: locData } = useApi<{ locations: LocationT[]; baseFare: number }>("/api/admin/locations");

  const pending = verifyData?.pending || [];
  const verifiedCount = verifyData?.verifiedCount || 0;
  const locations = locData?.locations || [];

  const hour = new Date().getHours();
  const greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-10 pt-6 sm:px-6">
      {/* Hero — ringkasan panel admin + aksi utama */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-unp to-unp-dark p-5 text-white shadow-lg sm:p-6">
        <div className="flex items-center gap-3.5">
          <UserAvatar name={me?.name || "Admin"} url={me?.avatarUrl} size={48} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{greet}, Admin</p>
            <h1 className="truncate text-xl font-extrabold leading-tight">{me?.name}</h1>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold">
            <ShieldCheck size={13} /> Panel KOMAH
          </span>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-white/85">
          Kelola verifikasi driver dan titik layanan KOMAH dari satu tempat.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl bg-white/12 px-3 py-2.5 text-center">
            <p className="text-xl font-extrabold leading-none">{pending.length}</p>
            <p className="mt-1 text-[10px] font-semibold leading-tight text-white/75">Menunggu verifikasi</p>
          </div>
          <div className="rounded-2xl bg-white/12 px-3 py-2.5 text-center">
            <p className="text-xl font-extrabold leading-none">{verifiedCount}</p>
            <p className="mt-1 text-[10px] font-semibold leading-tight text-white/75">Driver terverifikasi</p>
          </div>
          <div className="rounded-2xl bg-white/12 px-3 py-2.5 text-center">
            <p className="text-xl font-extrabold leading-none">{locations.length}</p>
            <p className="mt-1 text-[10px] font-semibold leading-tight text-white/75">Titik layanan</p>
          </div>
        </div>
      </section>

      {/* Dua halaman utama — bisa diklik langsung dari sini */}
      <section>
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">Halaman utama</h2>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <button
            onClick={() => navigate("/verifikasi")}
            className="group flex flex-col rounded-3xl border-2 border-unp/25 bg-card p-5 text-left shadow-sm transition-all hover:border-unp hover:shadow-lg active:scale-[0.98]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-unp text-white shadow-md">
                <ClipboardList size={22} />
              </span>
              {pending.length > 0 ? (
                <span className="rounded-full bg-gold px-2.5 py-1 text-[11px] font-extrabold text-unp-deep">
                  {pending.length} menunggu
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-unp-soft px-2.5 py-1 text-[11px] font-bold text-unp-dark">
                  <BadgeCheck size={12} /> Beres
                </span>
              )}
            </div>
            <p className="mt-3.5 text-base font-extrabold">Verifikasi Driver</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Periksa KTM & setujui pendaftaran driver baru.
            </p>
            <span className="mt-3 flex items-center gap-1 text-xs font-extrabold text-unp">
              Buka halaman <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>

          <button
            onClick={() => navigate("/kelola-lokasi")}
            className="group flex flex-col rounded-3xl border-2 border-gold/40 bg-card p-5 text-left shadow-sm transition-all hover:border-gold hover:shadow-lg active:scale-[0.98]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold text-unp-deep shadow-md">
                <MapPinned size={22} />
              </span>
              <span className="rounded-full bg-gold-soft px-2.5 py-1 text-[11px] font-extrabold text-gold-dark">
                {locations.length} titik
              </span>
            </div>
            <p className="mt-3.5 text-base font-extrabold">Kelola Lokasi &amp; Tarif</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Tambah titik layanan &amp; atur tarif zone. Dasar {rupiah(locData?.baseFare ?? 6000)}.
            </p>
            <span className="mt-3 flex items-center gap-1 text-xs font-extrabold text-gold-dark">
              Buka halaman <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>
      </section>

      {/* Sorotan pekerjaan — driver yang menunggu persetujuan */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">Perlu perhatian</h2>
          {pending.length > 0 && (
            <button
              onClick={() => navigate("/verifikasi")}
              className="text-xs font-extrabold text-unp underline-offset-2 hover:underline"
            >
              Lihat semua
            </button>
          )}
        </div>
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          {pending.length === 0 ? (
            <div className="flex items-center gap-3.5 px-5 py-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-unp-soft text-unp">
                <UserCheck size={20} />
              </span>
              <div>
                <p className="text-sm font-extrabold text-unp-dark">Tidak ada antrean verifikasi</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Pendaftaran driver baru akan muncul di sini.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pending.slice(0, 3).map((d) => (
                <button
                  key={d.id}
                  onClick={() => navigate("/verifikasi")}
                  className="flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-unp-soft/50"
                >
                  <UserAvatar name={d.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">{d.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.vehicleType} • {d.vehiclePlate}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-gold-soft px-2.5 py-1 text-[11px] font-bold text-gold-dark">
                    Periksa KTM
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
