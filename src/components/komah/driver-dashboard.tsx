"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Bike,
  Check,
  Inbox,
  Loader2,
  Navigation,
  Package,
  Phone,
  Radar,
  Star,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiCall, navigate, rupiah, timeId, useApi, useAuth } from "./lib";
import { TypeIcon, UserAvatar } from "./bits";
import type { DriverDashboardT } from "@/lib/types";

export function DriverDashboardView() {
  const { toast } = useToast();
  const { me, patchMe, refresh } = useAuth();
  const { data, refetch, loading } = useApi<DriverDashboardT>("/api/orders?scope=driver", { interval: 4000 });
  const [busyId, setBusyId] = useState<string | null>(null);
  // "gps" = kirim posisi asli, "demo" = GPS tidak tersedia → simulasi perjalanan.
  const [posMode, setPosMode] = useState<"gps" | "demo" | null>(null);

  const stats = data?.stats;
  const verified = stats?.verifyStatus === "VERIFIED";
  const isOnline = stats?.isOnline ?? false;
  const activeOrder = data?.active?.[0];

  // ===== Pengirim posisi untuk pelacakan live =====
  // Selama ada pesanan aktif: coba GPS browser; jika ditolak/gagal,
  // kirim posisi simulasi (interpolasi rute) agar penumpang tetap melihat
  // pergerakan — ditandai "posisi demo" di dashboard ini.
  const posKey = activeOrder ? `${activeOrder.id}:${activeOrder.status}` : null;
  useEffect(() => {
    if (!posKey || !activeOrder) return;
    const o = activeOrder;
    if (o.status !== "DIKONFIRMASI" && o.status !== "BERJALAN") return;

    let mode: "gps" | "demo" = "demo";
    let watchId: number | null = null;
    let cancelled = false;

    const send = (lat: number, lng: number) => {
      fetch(`/api/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "position", lat, lng }),
      }).catch(() => {});
    };

    const pickupLat = o.pickupLat ?? o.pickupLocation.lat;
    const pickupLng = o.pickupLng ?? o.pickupLocation.lng;
    const destLat = o.destLat ?? o.destLocation.lat;
    const destLng = o.destLng ?? o.destLocation.lng;

    const simulate = () => {
      if (pickupLat == null || pickupLng == null || destLat == null || destLng == null) return;
      if (o.status === "BERJALAN") {
        // Berkendara dari titik jemput ke tujuan (± 4 menit).
        const dur = 240_000;
        const since = new Date(o.startedAt || o.createdAt).getTime();
        const t = Math.min(Math.max((Date.now() - since) / dur, 0), 1);
        send(pickupLat + (destLat - pickupLat) * t, pickupLng + (destLng - pickupLng) * t);
      } else {
        // Menjemput: mendekat dari selatan menuju titik jemput (± 3 menit).
        const dur = 180_000;
        const since = new Date(o.acceptedAt || o.createdAt).getTime();
        const t = Math.min(Math.max((Date.now() - since) / dur, 0), 1);
        const fromLat = pickupLat - 0.0045;
        const fromLng = pickupLng - 0.003;
        send(fromLat + (pickupLat - fromLat) * t, fromLng + (pickupLng - fromLng) * t);
      }
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled) return;
          if (pos.coords.accuracy <= 500) {
            mode = "gps";
            setPosMode("gps");
            send(pos.coords.latitude, pos.coords.longitude);
          }
        },
        () => {
          mode = "demo";
          setPosMode("demo");
          simulate();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
      );
    } else {
      setTimeout(() => {
        if (!cancelled) setPosMode("demo");
      }, 0);
    }

    const tick = () => {
      if (!cancelled && mode === "demo") simulate();
    };
    tick();
    const timer = setInterval(tick, 8000);

    return () => {
      cancelled = true;
      if (watchId != null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      clearInterval(timer);
    };
  }, [posKey]);

  async function toggleOnline(next: boolean) {
    const { ok, data: res } = await apiCall("/api/driver/status", "POST", { isOnline: next });
    if (!ok) {
      toast({ title: "Gagal", description: res.error, variant: "destructive" });
      return;
    }
    patchMe({ isOnline: next });
    refetch();
    toast({
      title: next ? "Kamu sekarang ONLINE" : "Kamu sekarang OFFLINE",
      description: next ? "Pesanan baru akan muncul di bawah." : "Tidak akan menerima pesanan baru.",
    });
  }

  async function act(orderId: string, action: string) {
    setBusyId(orderId + action);
    const { ok, data: res } = await apiCall(`/api/orders/${orderId}`, "PATCH", { action });
    setBusyId(null);
    if (!ok) {
      toast({ title: "Gagal", description: res.error, variant: "destructive" });
      refetch();
      return;
    }
    toast({ title: "Berhasil", description: res.message });
    refetch();
    refresh();
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-10 pt-6 sm:px-6">
      {/* Kepala + toggle online */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold sm:text-2xl">Mode Driver</h1>
          <p className="mt-1 text-sm text-muted-foreground">Halo {me?.name}, semangat mengantarnya!</p>
        </div>
        <div
          className={cn(
            "flex items-center gap-4 rounded-2xl border-2 px-5 py-3.5 shadow-sm transition-colors",
            isOnline ? "border-unp bg-unp-soft" : "border-border bg-card"
          )}
        >
          <div>
            <p className={cn("text-sm font-extrabold", isOnline ? "text-unp-dark" : "text-muted-foreground")}>
              {isOnline ? "Online" : "Offline"}
            </p>
            <p className="text-[11px] text-muted-foreground">{isOnline ? "Menerima pesanan" : "Tidak aktif"}</p>
          </div>
          <Switch checked={isOnline} onCheckedChange={toggleOnline} disabled={!verified} className="data-[state=checked]:bg-unp" />
        </div>
      </div>

      {/* Peringatan verifikasi */}
      {!verified && (
        <div className="flex items-start gap-3.5 rounded-2xl border-2 border-gold/50 bg-gold-soft/50 p-4">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-gold-dark" />
          <div className="flex-1">
            <p className="font-extrabold text-gold-dark">
              {stats?.verifyStatus === "REJECTED" ? "Verifikasi ditolak" : "Menunggu verifikasi KTM"}
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-gold-dark/80">
              {stats?.verifyStatus === "REJECTED"
                ? "Mohon maaf, pendaftaran driver-mu belum disetujui admin. Hubungi tim KOMAH untuk info lebih lanjut."
                : "Akun driver-mu sedang diverifikasi admin (maks. 1x24 jam). Kamu bisa menjelajah aplikasi dulu, ya."}
            </p>
          </div>
        </div>
      )}

      {/* Statistik */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Wallet size={13} /> Pendapatan hari ini
          </p>
          <p className="mt-1.5 text-xl font-extrabold text-unp">{rupiah(stats?.todayEarnings || 0)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Bike size={13} /> Perjalanan hari ini
          </p>
          <p className="mt-1.5 text-xl font-extrabold">{stats?.todayTrips || 0}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <TrendingUp size={13} /> Total perjalanan
          </p>
          <p className="mt-1.5 text-xl font-extrabold">{stats?.totalTrips ?? me?.totalTrips ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Star size={13} /> Rating
          </p>
          <p className="mt-1.5 text-xl font-extrabold">
            {stats?.rating ? stats.rating.toFixed(1) : "Baru"}
            {stats?.ratingCount ? <span className="text-sm font-semibold text-muted-foreground"> ({stats.ratingCount})</span> : null}
          </p>
        </div>
      </div>

      {/* Pesanan aktif */}
      <section>
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">Pesanan Sedang Dikerjakan</h2>
        {loading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        ) : (data?.active || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-7 text-center text-sm text-muted-foreground">
            Belum ada pesanan aktif. Ambil pesanan baru di bawah!
          </div>
        ) : (
          data!.active.map((o) => (
            <div key={o.id} className="rounded-3xl border-2 border-unp/40 bg-gradient-to-br from-unp-soft/60 to-card p-5 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-unp px-3 py-1 text-xs font-extrabold text-white">
                  <TypeIcon type={o.type} size={13} className="text-white" /> {o.code}
                </span>
                <div className="flex items-center gap-2">
                  {posMode && (
                    <span
                      className={cn(
                        "hidden items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold sm:inline-flex",
                        posMode === "gps" ? "bg-unp/10 text-unp-dark" : "bg-gold-soft text-gold-dark"
                      )}
                      title={posMode === "gps" ? "Mengirim posisi GPS asli" : "GPS tidak tersedia — mengirim posisi simulasi"}
                    >
                      <Radar size={11} /> {posMode === "gps" ? "GPS live" : "Posisi demo"}
                    </span>
                  )}
                  <span className="text-lg font-extrabold text-unp">{rupiah(o.fare)}</span>
                </div>
              </div>

              <div className="mt-4 flex gap-3.5">
                <div className="flex flex-col items-center self-stretch pt-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-unp" />
                  <span className="my-1 w-0.5 flex-1 bg-gradient-to-b from-unp to-gold" />
                  <span className="h-2.5 w-2.5 rounded-full bg-gold" />
                </div>
                <div className="min-w-0 flex-1 space-y-2.5 text-sm">
                  <div>
                    <p className="font-bold">{o.pickupLocation.name}</p>
                    {o.pickupDetail && <p className="text-xs text-muted-foreground">{o.pickupDetail}</p>}
                  </div>
                  <div>
                    <p className="font-bold">{o.destLocation.name}</p>
                    {o.destDetail && <p className="text-xs text-muted-foreground">{o.destDetail}</p>}
                  </div>
                </div>
              </div>

              {o.itemNote && (
                <p className="mt-3 rounded-xl bg-gold-soft/60 px-3.5 py-2.5 text-xs font-semibold text-gold-dark">
                  {o.type === "MAKANAN" ? "Makanan" : "Barang"}: {o.itemNote}
                </p>
              )}
              {o.passengerNote && (
                <p className="mt-2 rounded-xl bg-muted px-3.5 py-2.5 text-xs text-muted-foreground">Catatan: {o.passengerNote}</p>
              )}

              {o.user && (
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-unp/15 pt-4">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar name={o.user.name} url={o.user.avatarUrl} size={36} />
                    <div>
                      <p className="text-sm font-extrabold">{o.user.name}</p>
                      <p className="text-[11px] text-muted-foreground">Penumpang terverifikasi civitas</p>
                    </div>
                  </div>
                  <a
                    href={`tel:${o.user.phone}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-unp text-white shadow-md transition-transform hover:scale-105"
                    aria-label={`Telepon ${o.user.name}`}
                  >
                    <Phone size={16} />
                  </a>
                </div>
              )}

              {o.status === "DIKONFIRMASI" ? (
                <Button
                  onClick={() => act(o.id, "start")}
                  disabled={busyId === o.id + "start"}
                  className="mt-4 h-12 w-full gap-2 bg-unp font-extrabold hover:bg-unp-dark"
                >
                  {busyId === o.id + "start" ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                  Penumpang Sudah Naik — Mulai Perjalanan
                </Button>
              ) : (
                <Button
                  onClick={() => act(o.id, "complete")}
                  disabled={busyId === o.id + "complete"}
                  className="mt-4 h-12 w-full gap-2 bg-gold font-extrabold text-unp-deep hover:bg-gold-dark hover:text-white"
                >
                  {busyId === o.id + "complete" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Selesaikan Pesanan (+{rupiah(o.fare - 1000)})
                </Button>
              )}
            </div>
          ))
        )}
      </section>

      {/* Pesanan masuk */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">Pesanan Masuk</h2>
          <span className="flex items-center gap-1.5 text-xs font-bold text-unp">
            <span className="relative flex h-2 w-2 rounded-full bg-unp text-unp pulse-ring" />
            Real-time
          </span>
        </div>

        {!verified ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-7 text-center text-sm text-muted-foreground">
            Pesanan masuk akan tersedia setelah verifikasi KTM-mu disetujui admin.
          </div>
        ) : !isOnline ? (
          <div className="rounded-2xl border border-dashed border-gold/50 bg-gold-soft/30 px-4 py-7 text-center text-sm font-semibold text-gold-dark">
            Aktifkan toggle <span className="font-extrabold">Online</span> di atas untuk mulai menerima pesanan.
          </div>
        ) : loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        ) : (data?.incoming || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center">
            <Inbox size={26} className="mx-auto text-muted-foreground" />
            <p className="mt-2.5 text-sm font-bold">Belum ada pesanan masuk</p>
            <p className="mt-1 text-xs text-muted-foreground">Pesanan baru dari penumpang akan muncul di sini secara otomatis.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data!.incoming.map((o) => (
              <div key={o.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-unp-soft px-2.5 py-1 text-[11px] font-extrabold text-unp-dark">
                    <TypeIcon type={o.type} size={12} /> {o.code} • {timeId(o.createdAt)} WIB
                  </span>
                  <span className="font-extrabold text-unp">{rupiah(o.fare)}</span>
                </div>
                <p className="mt-3 truncate text-sm font-bold">
                  {o.pickupLocation.name} → {o.destLocation.name}
                </p>
                {o.itemNote && <p className="mt-1 truncate text-xs text-muted-foreground">{o.itemNote}</p>}
                <div className="mt-3.5 flex items-center justify-between gap-3">
                  {o.user && (
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <UserAvatar name={o.user.name} url={o.user.avatarUrl} size={26} />
                      {o.user.name}
                    </span>
                  )}
                  <Button
                    onClick={() => act(o.id, "accept")}
                    disabled={busyId === o.id + "accept"}
                    size="sm"
                    className="gap-1.5 bg-unp font-extrabold hover:bg-unp-dark"
                  >
                    {busyId === o.id + "accept" ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                    Terima (+{rupiah(o.fare - 1000)})
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tips */}
      <div className="rounded-3xl bg-gradient-to-br from-unp-dark to-unp-deep p-5 text-white">
        <p className="flex items-center gap-2 font-extrabold">
          <Package size={17} className="text-gold" /> Tips meningkatkan pendapatan
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-green-50/90">
          <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-gold" /> Online pada jam sibuk: 07.00–09.00, 12.00–13.00, dan 16.00–18.00 WIB.</li>
          <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-gold" /> Jaga rating di atas 4.5 — penumpang lebih percaya driver bintang tinggi.</li>
          <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-gold" /> Kenali jalan pintas antar fakultas dan area kos untuk waktu tempuh lebih cepat.</li>
        </ul>
      </div>
    </div>
  );
}
