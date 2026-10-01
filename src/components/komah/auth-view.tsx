"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bike,
  CheckCircle2,
  Eye,
  EyeOff,
  FileImage,
  Loader2,
  Mail,
  Phone,
  Upload,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiCall, navigate, uploadFile, useAuth } from "./lib";
import { LogoKOMAH } from "./bits";
import type { Role } from "@/lib/types";

function AuthLayout({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-unp-soft/60 via-background to-background">
      <header className="border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <button onClick={() => navigate("/")} aria-label="Kembali ke beranda" className="active:scale-95 transition-transform">
            <LogoKOMAH />
          </button>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md">
          <button
            onClick={() => navigate("/")}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-unp"
          >
            <ArrowLeft size={15} /> Kembali ke beranda
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  );
}

// ================================ MASUK ================================
export function LoginView() {
  const { toast } = useToast();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doLogin(em: string, pw: string) {
    setBusy(true);
    setError(null);
    const { ok, data } = await apiCall<{ role: Role }>('/api/auth/login', 'POST', { email: em, password: pw });
    setBusy(false);
    if (!ok) {
      setError(data.error || "Gagal masuk.");
      return;
    }
    await refresh();
    toast({ title: "Berhasil masuk", description: "Selamat datang kembali di KOMAH!" });
    if (data.role === "ADMIN") navigate("/verifikasi");
    else if (data.role === "DRIVER") navigate("/mode-driver");
    else navigate("/beranda");
  }

  const demos: Array<{ label: string; email: string; desc: string }> = [
    { label: "Penumpang", email: "penumpang@komah.id", desc: "Rani Oktaviani" },
    { label: "Driver", email: "driver@komah.id", desc: "Ahmad Fauzan" },
    { label: "Admin", email: "admin@komah.id", desc: "Panel verifikasi" },
  ];

  return (
    <AuthLayout title="Masuk ke KOMAH" subtitle="Gunakan email dan kata sandi yang kamu daftarkan.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          doLogin(email, password);
        }}
        className="space-y-4"
      >
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>
        )}
        <div>
          <Label htmlFor="email" className="font-semibold">Email</Label>
          <div className="relative mt-1.5">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="h-12 border-2 pl-10"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="password" className="font-semibold">Kata Sandi</Label>
          <div className="relative mt-1.5">
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPw ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <Input
              id="password"
              type={showPw ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-12 border-2 pr-11"
            />
          </div>
        </div>
        <Button type="submit" disabled={busy} className="h-12 w-full bg-unp text-base font-extrabold hover:bg-unp-dark">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />} Masuk
        </Button>
      </form>

      <div className="mt-7 rounded-2xl border border-dashed border-unp/40 bg-unp-soft/60 p-4">
        <p className="text-xs font-extrabold uppercase tracking-wider text-unp-dark">Akun demo (klik untuk langsung masuk)</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {demos.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => doLogin(d.email, "komah123")}
              disabled={busy}
              className="rounded-xl border border-unp/25 bg-card px-2 py-2.5 text-center transition-all hover:border-unp hover:shadow-md disabled:opacity-60"
            >
              <span className="block text-xs font-extrabold text-unp-dark">{d.label}</span>
              <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">{d.desc}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Sandi semua akun demo: komah123</p>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Belum punya akun?{" "}
        <button onClick={() => navigate("/daftar")} className="font-bold text-unp hover:underline">
          Daftar sekarang
        </button>
      </p>
    </AuthLayout>
  );
}

// ================================ DAFTAR ================================
export function RegisterView({ initialRole }: { initialRole?: "USER" | "DRIVER" }) {
  const { toast } = useToast();
  const { refresh } = useAuth();
  const [role, setRole] = useState<"USER" | "DRIVER">(initialRole || "USER");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    nim: "",
    password: "",
    vehiclePlate: "",
    vehicleType: "",
  });
  const [ktmUrl, setKtmUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onKtmChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran foto KTM maksimal 5 MB.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const url = await uploadFile(file);
      setKtmUrl(url);
      toast({ title: "KTM terunggah", description: "Foto KTM berhasil diunggah." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah KTM.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await apiCall("/api/auth/register", "POST", { ...form, role, ktmUrl });
    setBusy(false);
    if (!ok) {
      setError(data.error || "Gagal mendaftar.");
      return;
    }
    toast({ title: "Pendaftaran berhasil", description: data.message });
    await refresh();
    navigate("/masuk");
  }

  const roleCards = [
    {
      value: "USER" as const,
      icon: UserIcon,
      title: "Sebagai Penumpang",
      desc: "Pesan ojek & antar barang",
    },
    {
      value: "DRIVER" as const,
      icon: Wallet,
      title: "Sebagai Driver",
      desc: "Cari penghasilan tambahan",
    },
  ];

  return (
    <AuthLayout
      title="Buat akun KOMAH"
      subtitle="Khusus civitas UNP — pastikan NIM/NIP kamu aktif. Driver akan diverifikasi KTM oleh admin."
    >
      <div className="grid grid-cols-2 gap-3">
        {roleCards.map((rc) => (
          <button
            key={rc.value}
            type="button"
            onClick={() => setRole(rc.value)}
            className={cn(
              "rounded-2xl border-2 p-4 text-left transition-all",
              role === rc.value ? "border-unp bg-unp-soft shadow-md" : "border-border bg-card hover:border-unp/40"
            )}
          >
            <rc.icon size={22} className={role === rc.value ? "text-unp" : "text-muted-foreground"} />
            <p className="mt-2.5 text-sm font-extrabold">{rc.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{rc.desc}</p>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>
        )}

        <div>
          <Label htmlFor="reg-name" className="font-semibold">Nama Lengkap</Label>
          <Input id="reg-name" required value={form.name} onChange={set("name")} placeholder="cth: Budi Santoso" className="mt-1.5 h-12 border-2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="reg-email" className="font-semibold">Email</Label>
            <Input id="reg-email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} placeholder="nama@email.com" className="mt-1.5 h-12 border-2" />
          </div>
          <div>
            <Label htmlFor="reg-phone" className="font-semibold">No. HP (WhatsApp)</Label>
            <div className="relative mt-1.5">
              <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input id="reg-phone" required value={form.phone} onChange={set("phone")} placeholder="08xxxxxxxxxx" className="h-12 border-2 pl-10" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="reg-nim" className="font-semibold">NIM / NIP</Label>
            <Input id="reg-nim" required value={form.nim} onChange={set("nim")} placeholder="cth: 2310245078" className="mt-1.5 h-12 border-2" />
          </div>
          <div>
            <Label htmlFor="reg-pw" className="font-semibold">Kata Sandi</Label>
            <Input id="reg-pw" type="password" required minLength={6} autoComplete="new-password" value={form.password} onChange={set("password")} placeholder="Min. 6 karakter" className="mt-1.5 h-12 border-2" />
          </div>
        </div>

        {role === "DRIVER" && (
          <div className="space-y-4 rounded-2xl border border-gold/40 bg-gold-soft/40 p-4">
            <p className="flex items-center gap-2 text-sm font-extrabold text-gold-dark">
              <Bike size={16} /> Data Driver & Verifikasi KTM
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="reg-plate" className="font-semibold">Nomor Polisi</Label>
                <Input id="reg-plate" required value={form.vehiclePlate} onChange={set("vehiclePlate")} placeholder="cth: BA 1234 AB" className="mt-1.5 h-12 border-2" />
              </div>
              <div>
                <Label htmlFor="reg-vehicle" className="font-semibold">Jenis Motor</Label>
                <Input id="reg-vehicle" required value={form.vehicleType} onChange={set("vehicleType")} placeholder="cth: Honda Beat Merah" className="mt-1.5 h-12 border-2" />
              </div>
            </div>
            <div>
              <Label className="font-semibold">Foto KTM (Kartu Tanda Mahasiswa)</Label>
              <label
                htmlFor="reg-ktm"
                className={cn(
                  "mt-1.5 flex cursor-pointer items-center gap-3.5 rounded-xl border-2 border-dashed px-4 py-4 transition-colors",
                  ktmUrl ? "border-unp bg-unp-soft/50" : "border-input hover:border-unp/50"
                )}
              >
                {ktmUrl ? (
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-unp text-white">
                    <CheckCircle2 size={20} />
                  </span>
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">
                    {uploading ? "Mengunggah KTM…" : ktmUrl ? "KTM terunggah — klik untuk ganti" : "Unggah foto KTM (JPG/PNG, maks 5 MB)"}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Dipakai admin untuk memverifikasi identitas mahasiswamu
                  </span>
                </span>
                {ktmUrl && (
                  <img src={ktmUrl} alt="Pratinjau KTM" className="h-11 w-16 rounded-lg border border-border object-cover" />
                )}
              </label>
              <input id="reg-ktm" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onKtmChange} />
            </div>
          </div>
        )}

        <Button type="submit" disabled={busy || uploading} className="h-12 w-full bg-unp text-base font-extrabold hover:bg-unp-dark">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <BadgeCheck size={18} />}
          {role === "DRIVER" ? "Daftar & Kirim Verifikasi" : "Daftar Sekarang"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <button onClick={() => navigate("/masuk")} className="font-bold text-unp hover:underline">
          Masuk di sini
        </button>
      </p>
    </AuthLayout>
  );
}
