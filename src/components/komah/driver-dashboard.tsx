"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Bike,
  Inbox,
  Loader2,
  MapPin,
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
import { DriverActiveOrder } from "./driver-active-order";
import { DriverOrderPreview } from "./driver-order-preview";
import type { DriverDashboardT, OrderT } from "@/lib/types";

export function DriverDashboardView() {
  const { toast } = useToast();
  const { me, patchMe, refresh } = useAuth();
  const { data, refetch, loading } = useApi<DriverDashboardT>("/api/orders?scope=driver", { interval: 4000 });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<OrderT | null>(null);
  const [acceptBusy, setAcceptBusy] = useState(false);

  const stats = data?.stats;
  const verified = stats?.verifyStatus === "VERIFIED";
  const isOnline = stats?.isOnline ?? false;
  const activeOrder = data?.active?.[0];

  // ===== Pengirim posisi untuk pelacakan live =====
  // Selama ada pesanan aktif: kirim GPS browser bila tersedia; jika ditolak,
  // kirim posisi simulasi (interpolasi rute) agar penumpang tetap melihat
  // pergerakan. Berjalan senyap — driver fokus berkendara.
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
            send(pos.coords.latitude, pos.coords.longitude);
          }
        },
        () => {
          mode = "demo";
          simulate();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
      );
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

  async function acceptOrder(order: OrderT) {
    setAcceptBusy(true);
    const { ok, data: res } = await apiCall(`/api/orders/${order.id}`, "PATCH", { action: "accept" });
    setAcceptBusy(false);
    if (!ok) {
      toast({ title: "Gagal", description: res.error, variant: "destructive" });
      refetch();
      return;
    }
    setPreviewOrder(null);
    toast({ title: "Pesanan diterima", description: res.message });
    refetch();
    refresh();
  }

  // ===== MODE FOKUS: sedang mengantar → hanya pesanan aktif =====
  if (activeOrder) {
    return <DriverActiveOrder order={activeOrder} onAct={act} busy={busyId} />;
  }

  // ===== Idle: statistik, toggle online, pesanan masuk =====
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

      {/* Statistik (hanya saat idle) */}
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

      {/* Pesanan masuk — kartu bisa diketuk untuk melihat titik di peta */}
      <section>
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">Pesanan Masuk</h2>

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
                <button
                  type="button"
                  onClick={() => setPreviewOrder(o)}
                  className="-m-4 w-full cursor-pointer rounded-2xl p-4 text-left transition-colors hover:bg-unp-soft/40"
                >
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
                  <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-unp">
                    <MapPin size={11} /> Ketuk untuk lihat titik di peta
                  </p>
                  {o.user && (
                    <span className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <UserAvatar name={o.user.name} url={o.user.avatarUrl} size={26} />
                      {o.user.name}
                    </span>
                  )}
                </button>
                <Button
                  onClick={() => acceptOrder(o)}
                  disabled={acceptBusy}
                  size="sm"
                  className="mt-3 w-full gap-1.5 bg-unp font-extrabold hover:bg-unp-dark"
                >
                  {acceptBusy ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                  Terima (+{rupiah(o.fare - 1000)})
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pratinjau pesanan masuk (peta + titik penumpang) */}
      <DriverOrderPreview
        order={previewOrder}
        open={!!previewOrder}
        onOpenChange={(o) => !o && setPreviewOrder(null)}
        onAccept={acceptOrder}
        busy={acceptBusy}
      />
    </div>
  );
}
