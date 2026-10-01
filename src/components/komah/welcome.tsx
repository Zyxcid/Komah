"use client";

import { Bike, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigate, useAuth } from "./lib";
import { LogoKOMAH } from "./bits";

// Gerbang masuk aplikasi — minimal & fungsional.
// Tanpa berkas iklan: cukup identitas + dua aksi (masuk / daftar).
export function Welcome() {
  const { me, loading } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-unp-soft/70 via-background to-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <LogoKOMAH />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-unp to-unp-dark shadow-lg shadow-unp/30">
            <Bike size={38} className="text-white" strokeWidth={2.2} />
            <span className="relative -mt-14 ml-14 h-3 w-3 rounded-full bg-gold ring-4 ring-white" aria-hidden />
          </div>

          <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Ojek &amp; titip antar khusus civitas UNP
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            Masuk untuk mulai memesan — tarif tampil sejak awal, bayar tunai saat sampai.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <Button
              onClick={() => navigate("/masuk")}
              className="h-12 bg-unp text-base font-extrabold hover:bg-unp-dark"
            >
              <LogIn size={17} /> Masuk
            </Button>
            <Button
              onClick={() => navigate("/daftar")}
              variant="outline"
              className="h-12 border-2 text-base font-extrabold hover:border-unp hover:bg-unp-soft hover:text-unp-dark"
            >
              <UserPlus size={17} /> Daftar
            </Button>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Ingin cari penghasilan di sela kuliah?{" "}
            <button onClick={() => navigate("/daftar?role=DRIVER")} className="font-bold text-unp hover:underline">
              Daftar jadi driver
            </button>
          </p>

          <p className="mt-10 text-center text-[11px] leading-relaxed text-muted-foreground">
            Driver mahasiswa terverifikasi KTM &middot; Tarif tetap berbasis zona &middot; Pembayaran tunai
          </p>

          {loading && <span className="sr-only">Memuat sesi…</span>}
          {me && (
            <p className="mt-4 text-xs text-muted-foreground">
              Kamu sudah masuk sebagai {me.name}.{" "}
              <button onClick={() => navigate("/beranda")} className="font-bold text-unp hover:underline">
                Buka aplikasi
              </button>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
