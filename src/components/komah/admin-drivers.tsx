"use client";

// Kelola driver (admin) — direktori seluruh driver beserta rating,
// statistik perjalanan, status online/verifikasi, dan status blokir.
// Admin dapat memblokir driver yang melanggar aturan (dengan alasan,
// kabar via push) dan membuka blokirnya kembali. Kontak cepat via
// WhatsApp tetap memakai kanal resmi KOMAH.

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Bike,
  Check,
  Loader2,
  MessageCircle,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiCall, dateId, rupiah, useApi, waLink } from "./lib";
import { EmptyState, UserAvatar } from "./bits";
import type { DriverAdminT } from "@/lib/types";

type Filter = "semua" | "online" | "terblokir" | "menunggu";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "semua", label: "Semua" },
  { key: "online", label: "Online" },
  { key: "terblokir", label: "Terblokir" },
  { key: "menunggu", label: "Menunggu verifikasi" },
];

function ratingColor(r: number) {
  if (r === 0) return "text-muted-foreground";
  if (r >= 4.5) return "text-unp";
  if (r >= 4) return "text-gold-dark";
  return "text-red-600";
}

export function AdminDriversView() {
  const { toast } = useToast();
  const { data, refetch, loading, error } = useApi<{ drivers: DriverAdminT[] }>("/api/admin/drivers", { interval: 15000 });
  const drivers = data?.drivers || [];

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("semua");

  // Dialog blokir (dengan alasan wajib).
  const [banTarget, setBanTarget] = useState<DriverAdminT | null>(null);
  const [reason, setReason] = useState("");
  const [banBusy, setBanBusy] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return drivers.filter((d) => {
      if (filter === "online" && !d.isOnline) return false;
      if (filter === "terblokir" && !d.banned) return false;
      if (filter === "menunggu" && d.verifyStatus !== "PENDING") return false;
      if (!needle) return true;
      return (
        d.name.toLowerCase().includes(needle) ||
        (d.nim || "").toLowerCase().includes(needle) ||
        d.phone.includes(needle) ||
        (d.vehiclePlate || "").toLowerCase().includes(needle)
      );
    });
  }, [drivers, q, filter]);

  const onlineCount = drivers.filter((d) => d.isOnline && !d.banned).length;
  const bannedCount = drivers.filter((d) => d.banned).length;

  async function submitBan() {
    if (!banTarget) return;
    setBanBusy(true);
    const { ok, data: res } = await apiCall(`/api/admin/drivers/${banTarget.id}`, "PATCH", {
      action: "ban",
      reason: reason.trim(),
    });
    setBanBusy(false);
    if (!ok) {
      toast({ title: "Gagal memblokir", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Driver diblokir", description: res.message });
    setBanTarget(null);
    setReason("");
    refetch();
  }

  async function unban(d: DriverAdminT) {
    setBusyId(d.id);
    const { ok, data: res } = await apiCall(`/api/admin/drivers/${d.id}`, "PATCH", { action: "unban" });
    setBusyId(null);
    if (!ok) {
      toast({ title: "Gagal membuka blokir", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Blokir dibuka", description: res.message });
    refetch();
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-10 pt-6 sm:px-6">
      {/* Ringkasan */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Users size={13} /> Total driver
          </p>
          <p className="mt-1.5 text-2xl font-extrabold">{drivers.length}</p>
        </div>
        <div className="rounded-2xl border border-unp/30 bg-unp-soft/40 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Bike size={13} /> Online
          </p>
          <p className="mt-1.5 text-2xl font-extrabold text-unp">{onlineCount}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Ban size={13} /> Terblokir
          </p>
          <p className="mt-1.5 text-2xl font-extrabold text-red-600">{bannedCount}</p>
        </div>
      </div>

      {/* Pencarian + filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, NIM, telepon, atau plat kendaraan…"
            className="h-12 border-2 pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                "rounded-full border-2 px-3.5 py-1.5 text-xs font-bold transition-colors",
                filter === f.key
                  ? "border-unp bg-unp-soft text-unp-dark"
                  : "border-border bg-card text-muted-foreground hover:border-unp/40"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gagal memuat: tampilkan JELAS — jangan terlihat seperti "kosong"
          (penyebab klasik: database belum db:push setelah pembaruan skema). */}
      {error ? (
        <EmptyState
          icon={<AlertTriangle size={26} />}
          title="Gagal memuat daftar driver"
          desc={`${error} Coba muat ulang; bila berlanjut, jalankan npm run db:push dan periksa log server.`}
        />
      ) : loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={26} />}
          title={drivers.length === 0 ? "Belum ada driver" : "Tidak ada yang cocok"}
          desc={drivers.length === 0 ? "Driver akan muncul di sini setelah mendaftar." : "Coba ubah kata kunci atau filter."}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((d) => (
            <div
              key={d.id}
              className={cn(
                "rounded-2xl border bg-card p-4 shadow-sm",
                d.banned ? "border-red-300" : d.isOnline ? "border-unp/30" : "border-border"
              )}
            >
              <div className="flex items-start gap-3.5">
                <UserAvatar name={d.name} url={d.avatarUrl} size={46} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold">{d.name}</p>
                    {d.banned ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-700">DIBLOKIR</span>
                    ) : d.verifyStatus === "VERIFIED" ? (
                      <span className="flex items-center gap-0.5 rounded-full bg-unp-soft px-2 py-0.5 text-[10px] font-extrabold text-unp-dark">
                        <ShieldCheck size={10} /> Terverifikasi
                      </span>
                    ) : d.verifyStatus === "PENDING" ? (
                      <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-extrabold text-gold-dark">Menunggu</span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-extrabold text-muted-foreground">Ditolak</span>
                    )}
                    {d.isOnline && !d.banned && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">ONLINE</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {d.vehicleType || "Kendaraan -"} • {d.vehiclePlate || "plat -"} • {d.nim || "NIM -"}
                  </p>
                  <p className="text-xs text-muted-foreground">Terdaftar {dateId(d.createdAt)}</p>

                  {/* Statistik */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className={cn("flex items-center gap-1 font-bold", ratingColor(d.rating))}>
                      <Star size={12} className="fill-current" />
                      {d.rating > 0 ? d.rating.toFixed(1) : "Baru"}
                      {d.ratingCount > 0 && <span className="font-normal text-muted-foreground">({d.ratingCount})</span>}
                    </span>
                    <span className="flex items-center gap-1 font-semibold">
                      <TrendingUp size={12} className="text-muted-foreground" />
                      {d.totalTrips} perjalanan
                    </span>
                    <span className="font-semibold text-muted-foreground">{rupiah(d.totalEarnings)} pendapatan</span>
                    {d.activeOrders > 0 && (
                      <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-extrabold text-gold-dark">
                        Sedang mengantar {d.activeOrders} pesanan
                      </span>
                    )}
                  </div>

                  {d.banned && d.banReason && (
                    <p className="mt-2.5 rounded-xl bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
                      <span className="font-extrabold">Alasan blokir:</span> {d.banReason}
                    </p>
                  )}
                </div>

                {/* Aksi */}
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button
                    onClick={() => {
                      const link = waLink(d.phone, `Halo ${d.name}, kami dari admin KOMAH.`);
                      if (link) window.open(link, "_blank");
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                    aria-label={`Hubungi ${d.name} via WhatsApp`}
                  >
                    <MessageCircle size={16} />
                  </button>
                  {d.banned ? (
                    <button
                      onClick={() => unban(d)}
                      disabled={busyId === d.id}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
                      aria-label={`Buka blokir ${d.name}`}
                    >
                      {busyId === d.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setBanTarget(d);
                        setReason("");
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label={`Blokir ${d.name}`}
                    >
                      <Ban size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog blokir */}
      <Dialog open={!!banTarget} onOpenChange={(o) => !o && setBanTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban size={17} className="text-red-600" /> Blokir {banTarget?.name}?
            </DialogTitle>
            <DialogDescription>
              Driver tidak bisa online atau menerima pesanan baru (login tetap boleh). Pesanan yang
              sedang berjalan tetap bisa diselesaikan. Driver akan menerima notifikasi berisi alasan ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ban-reason" className="font-semibold">
              Alasan pemblokiran (wajib)
            </Label>
            <Input
              id="ban-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="cth: Meminta top-up pulsa ke penumpang"
              className="border-2"
              maxLength={200}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              {reason.trim().length}/200 karakter — minimal 4.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanTarget(null)} className="border-2 font-bold">
              Batal
            </Button>
            <Button onClick={submitBan} disabled={banBusy || reason.trim().length < 4} className="gap-2 bg-red-600 font-extrabold hover:bg-red-700">
              {banBusy ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />}
              Ya, Blokir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
