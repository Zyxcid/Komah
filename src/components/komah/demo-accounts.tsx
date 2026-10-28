"use client";

// ===================== Info Akun Demo =====================
// Halaman khusus berisi kredensial akun uji coba KOMAH. Dipisahkan dari
// halaman Masuk agar alur login asli tetap bersih — di sini kredensial
// hanya DITAMPILKAN (plus tombol salin), tanpa tombol "langsung masuk".
// Rute: #/akun-demo (publik, tidak butuh sesi).

import { useState } from "react";
import {
  ArrowLeft,
  Bike,
  Check,
  Copy,
  Info,
  KeyRound,
  LogIn,
  Mail,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { navigate } from "./lib";
import { LogoKOMAH } from "./bits";

const DEMO_PASSWORD = "komah123";

const DEMO_ACCOUNTS = [
  {
    role: "Penumpang",
    name: "Rani Oktaviani",
    email: "penumpang@komah.id",
    desc: "Memesan ojek, antar barang & makanan, melihat riwayat pesanan.",
    icon: UserIcon,
    iconBg: "bg-unp",
  },
  {
    role: "Driver",
    name: "Ahmad Fauzan",
    email: "driver@komah.id",
    desc: "Menerima pesanan masuk, mengantar penumpang/barang, mode penumpang tetap tersedia.",
    icon: Bike,
    iconBg: "bg-gold",
  },
  {
    role: "Admin",
    name: "Panel Admin",
    email: "admin@komah.id",
    desc: "Memverifikasi driver baru (KTM), mengelola lokasi & pengaturan tarif.",
    icon: ShieldCheck,
    iconBg: "bg-unp-deep",
  },
] as const;

function CopyField({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Mail }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ title: "Tersalin", description: `${label} disalin ke papan klip.` });
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ title: "Gagal menyalin", description: "Salin manual dengan menekan lama teksnya.", variant: "destructive" });
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-unp/50"
      aria-label={`Salin ${label}`}
    >
      <Icon size={15} className="shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="block truncate text-sm font-bold">{value}</span>
      </span>
      {copied ? (
        <Check size={15} className="shrink-0 text-unp" />
      ) : (
        <Copy size={15} className="shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

export function DemoAccountsView() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-unp-soft/60 via-background to-background">
      <header className="border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <button onClick={() => navigate("/")} aria-label="Kembali ke beranda" className="active:scale-95 transition-transform">
            <LogoKOMAH />
          </button>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md">
          <button
            onClick={() => navigate("/")}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-unp"
          >
            <ArrowLeft size={15} /> Kembali ke beranda
          </button>

          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Akun Demo</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Akun uji coba untuk mencoba semua peran di KOMAH sebelum mendaftar dengan identitas asli.
            Ketuk kolom email atau sandi untuk menyalinnya.
          </p>

          <div className="mt-7 space-y-4">
            {DEMO_ACCOUNTS.map((a) => (
              <div key={a.email} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-md", a.iconBg)}>
                    <a.icon size={21} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold">{a.role}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.name}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{a.desc}</p>
                <div className="mt-3.5 space-y-2">
                  <CopyField label="Email" value={a.email} icon={Mail} />
                  <CopyField label="Sandi" value={DEMO_PASSWORD} icon={KeyRound} />
                </div>
                <Button
                  onClick={() => navigate(`/masuk?email=${encodeURIComponent(a.email)}`)}
                  variant="outline"
                  className="mt-3 h-10 w-full border-2 font-bold hover:border-unp hover:bg-unp-soft hover:text-unp-dark"
                >
                  <LogIn size={16} /> Masuk sebagai {a.role}
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-gold/40 bg-gold-soft/50 p-4">
            <Info size={16} className="mt-0.5 shrink-0 text-gold-dark" />
            <p className="text-xs leading-relaxed text-foreground/80">
              Akun demo hanya untuk pengujian — data di dalamnya boleh diubah dan dapat
              direset kapan saja. Untuk penggunaan nyata, daftarkan akun sendiri dengan
              NIM/NIP aktif.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
