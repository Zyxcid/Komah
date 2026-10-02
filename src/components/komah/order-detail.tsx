"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Bike,
  Check,
  ClipboardList,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  ShieldQuestion,
  Star,
  Timer,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiCall, dateId, rupiah, timeId, useApi, waLink } from "./lib";
import { RouteMap } from "./map-view";
import { useOsmrRoute } from "./use-route";
import { RatingStars, StatusBadge, TypeBadge, UserAvatar } from "./bits";
import type { OrderT } from "@/lib/types";

const TIMELINE = [
  { key: "MENCARI", label: "Pesanan dibuat, mencari driver", timeKey: "createdAt" as const, icon: ClipboardList },
  { key: "DIKONFIRMASI", label: "Driver ditemukan, menuju titik jemput", timeKey: "acceptedAt" as const, icon: Navigation },
  { key: "BERJALAN", label: "Dalam perjalanan ke tujuan", timeKey: "startedAt" as const, icon: Bike },
  { key: "SELESAI", label: "Pesanan selesai, sampai tujuan", timeKey: "completedAt" as const, icon: Check },
];

export function OrderDetailView({ code }: { code: string }) {
  const { toast } = useToast();
  const { data, refetch } = useApi<{ order: OrderT }>(`/api/orders/${code}`, { interval: 4000 });
  const order = data?.order;
  const [busy, setBusy] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState("");

  // Titik peta: prioritas koordinat pesanan (pin yang digeser), fallback lokasi.
  const pickupPos = useMemo(() => {
    if (!order) return null;
    if (order.pickupLat != null && order.pickupLng != null) return { lat: order.pickupLat, lng: order.pickupLng };
    if (order.pickupLocation.lat != null && order.pickupLocation.lng != null)
      return { lat: order.pickupLocation.lat, lng: order.pickupLocation.lng };
    return null;
  }, [order]);
  const destPos = useMemo(() => {
    if (!order) return null;
    if (order.destLat != null && order.destLng != null) return { lat: order.destLat, lng: order.destLng };
    if (order.destLocation.lat != null && order.destLocation.lng != null)
      return { lat: order.destLocation.lat, lng: order.destLocation.lng };
    return null;
  }, [order]);
  const driverPos = useMemo(
    () => (order?.driverLat != null && order.driverLng != null ? { lat: order.driverLat, lng: order.driverLng } : null),
    [order]
  );

  // Rute jalan dari OSRM (hook bersama) — gagal → peta menggambar garis lurus.
  const route = useOsmrRoute(pickupPos, destPos, order ? order.id : null);

  const currentStep = useMemo(() => {
    if (!order) return -1;
    if (order.status === "DIBATALKAN") return -1;
    return TIMELINE.findIndex((t) => t.key === order.status);
  }, [order]);

  async function act(action: string, extra?: Record<string, unknown>) {
    if (!order) return;
    setBusy(true);
    const { ok, data: res } = await apiCall<{ order: OrderT }>(`/api/orders/${order.id}`, "PATCH", { action, ...extra });
    setBusy(false);
    if (!ok) {
      toast({ title: "Gagal", description: res.error, variant: "destructive" });
      return;
    }
    if (action === "cancel") {
      toast({ title: "Pesanan dibatalkan", description: "Semoga pesanan berikutnya lebih pas waktunya." });
    }
    refetch();
  }

  async function submitRating() {
    if (stars < 1) return;
    setBusy(true);
    const { ok, data: res } = await apiCall<{ order: OrderT }>(`/api/orders/${order!.id}`, "PATCH", {
      action: "rate",
      rating: stars,
      review,
    });
    setBusy(false);
    if (!ok) {
      toast({ title: "Gagal memberi rating", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Terima kasih!", description: "Penilaianmu membantu kualitas layanan KOMAH." });
    setRateOpen(false);
    refetch();
  }

  if (!order) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-unp" />
      </div>
    );
  }

  const isMine = true; // API sudah memvalidasi akses
  const canCancel = isMine && ["MENCARI", "DIKONFIRMASI"].includes(order.status);
  const canRate = isMine && order.status === "SELESAI" && !order.rating;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-10 pt-6 sm:px-6">
      {/* Kepala halaman — tombol kembali global ada di header aplikasi */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-extrabold">{order.code}</h1>
          <p className="text-xs text-muted-foreground">{dateId(order.createdAt)} • {timeId(order.createdAt)} WIB</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Peta rute live (OpenStreetMap) + posisi driver */}
      {pickupPos && destPos ? (
        <RouteMap pickup={pickupPos} dest={destPos} driver={driverPos} route={route?.line || null} />
      ) : (
        <div className="flex items-center gap-3.5 rounded-3xl border border-border bg-gradient-to-br from-unp-soft/70 to-gold-soft/30 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-unp shadow-sm">
            <MapPin size={20} />
          </span>
          <p className="text-sm font-semibold text-muted-foreground">
            Peta belum tersedia untuk rute ini. Lihat detail titik jemput & tujuan di bawah.
          </p>
        </div>
      )}
      {order.status === "DIKONFIRMASI" && driverPos && (
        <p className="-mt-2 flex items-center gap-1.5 text-xs font-semibold text-unp-dark">
          <Navigation size={13} className="text-unp" /> Posisi driver diperbarui otomatis.
        </p>
      )}

      {/* Status pesan khusus */}
      {order.status === "MENCARI" && (
        <div className="flex items-center gap-3.5 rounded-2xl border border-unp/25 bg-unp-soft/60 p-4">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-unp text-white pulse-ring text-unp">
            <Loader2 size={18} className="animate-spin" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-unp-dark">Sedang mencarikan driver terdekat…</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Biasanya kurang dari 3 menit pada jam kuliah.</p>
          </div>
        </div>
      )}
      {order.status === "DIBATALKAN" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-extrabold text-red-600">Pesanan dibatalkan</p>
          <p className="mt-0.5 text-xs text-red-500">
            Dibatalkan {order.cancelledAt ? `pada ${dateId(order.cancelledAt)} ${timeId(order.cancelledAt)} WIB` : ""}. Tidak ada biaya yang dikenakan.
          </p>
        </div>
      )}

      {/* Kartu driver */}
      {order.driver ? (
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <UserAvatar name={order.driver.name} url={order.driver.avatarUrl} size={52} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-extrabold">
                {order.driver.name} <BadgeCheck size={15} className="text-unp" />
              </p>
              <p className="text-xs text-muted-foreground">
                {order.driver.vehicleType} • {order.driver.vehiclePlate}
              </p>
              <div className="mt-1">
                <RatingStars value={order.driver.rating ?? 0} count={order.driver.ratingCount} size={12} />
              </div>
            </div>
            <a
              href={waLink(order.driver.phone, `Halo, saya ${order.user?.name || "penumpang"}, penumpang KOMAH ${order.code}.`) || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-unp text-white shadow-md transition-transform hover:scale-105"
              aria-label={`Chat WhatsApp ${order.driver.name}`}
            >
              <MessageCircle size={18} />
            </a>
          </div>
          <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-unp-soft px-3 py-2 text-[11px] font-semibold text-unp-dark">
            <ShieldQuestion size={13} /> Driver terverifikasi KTM, identitas mahasiswa UNP aktif.
          </p>
        </div>
      ) : order.status !== "DIBATALKAN" ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 p-5 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MapPin size={20} />
          </div>
          <p className="mt-2.5 text-sm font-bold">Menunggu driver menerima pesanan</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Detail driver akan muncul di sini begitu pesanan diterima.</p>
        </div>
      ) : null}

      {/* Lini masa status */}
      {order.status !== "DIBATALKAN" && (
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-extrabold">
            <Timer size={16} className="text-unp" /> Status perjalanan
          </p>
          <ol className="mt-4 space-y-0">
            {TIMELINE.map((t, i) => {
              const done = i < currentStep;
              const active = i === currentStep;
              const time = order[t.timeKey];
              return (
                <li key={t.key} className="flex gap-3.5">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        done && "border-unp bg-unp text-white",
                        active && "border-unp bg-unp-soft text-unp",
                        !done && !active && "border-border bg-muted text-muted-foreground"
                      )}
                    >
                      <t.icon size={14} />
                    </span>
                    {i < TIMELINE.length - 1 && (
                      <span className={cn("my-1 w-0.5 flex-1 rounded-full", done ? "bg-unp" : "bg-border")} style={{ minHeight: 20 }} />
                    )}
                  </div>
                  <div className={cn("pb-4", !done && !active && "opacity-50")}>
                    <p className={cn("text-sm leading-snug", active && "font-extrabold text-unp-dark", !active && "font-semibold")}>{t.label}</p>
                    {time && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {timeId(time)} WIB
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Detail pesanan */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold">Detail pesanan</p>
          <TypeBadge type={order.type} />
        </div>
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Titik jemput</p>
            <p className="mt-0.5 font-bold">{order.pickupLocation.name}</p>
            {order.pickupDetail && <p className="text-muted-foreground">{order.pickupDetail}</p>}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tujuan</p>
            <p className="mt-0.5 font-bold">{order.destLocation.name}</p>
            {order.destDetail && <p className="text-muted-foreground">{order.destDetail}</p>}
          </div>
          {order.itemNote && (
            <div className="rounded-xl bg-gold-soft/50 px-3.5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gold-dark">
                {order.type === "BARANG" ? "Barang diantar" : order.type === "MAKANAN" ? "Makanan dipesan" : "Catatan"}
              </p>
              <p className="mt-0.5 font-semibold">{order.itemNote}</p>
            </div>
          )}
          {order.passengerNote && (
            <div className="rounded-xl bg-muted px-3.5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Catatan penumpang</p>
              <p className="mt-0.5 font-semibold">{order.passengerNote}</p>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-3.5">
            <span className="text-muted-foreground">Metode pembayaran</span>
            <span className="font-bold">Tunai</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tarif</span>
            <span className="text-lg font-extrabold text-unp">{rupiah(order.fare)}</span>
          </div>
        </div>
      </div>

      {/* Ulasan yang sudah diberikan */}
      {order.rating && (
        <div className="rounded-3xl border border-unp/25 bg-unp-soft/50 p-5">
          <p className="text-sm font-extrabold text-unp-dark">Penilaianmu untuk pesanan ini</p>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={20} className={s <= (order.rating || 0) ? "fill-gold text-gold" : "text-gray-300"} />
            ))}
          </div>
          {order.review && <p className="mt-2 text-sm italic text-muted-foreground">“{order.review}”</p>}
        </div>
      )}

      {/* Aksi */}
      <div className="space-y-3">
        {canRate && (
          <Button onClick={() => setRateOpen(true)} className="h-13 w-full gap-2 bg-gold text-base font-extrabold text-unp-deep hover:bg-gold-dark hover:text-white">
            <Star size={18} className="fill-unp-deep" /> Beri Rating Driver
          </Button>
        )}
        {canCancel && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={busy} className="h-12 w-full border-2 border-red-200 font-bold text-red-600 hover:bg-red-50 hover:text-red-600">
                <X size={16} /> Batalkan Pesanan
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Batalkan pesanan ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  {order.status === "MENCARI"
                    ? "Pesananmu belum diterima driver. Pembatalan tidak dikenakan biaya apa pun."
                    : "Driver sudah menuju titik jemput. Mohon batalkan hanya jika benar-benar diperlukan. Driver sudah meluangkan waktu."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Jangan</AlertDialogCancel>
                <AlertDialogAction onClick={() => act("cancel")} className="bg-red-600 hover:bg-red-700">
                  Ya, Batalkan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Dialog rating */}
      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-center">
            <DialogTitle className="text-center">Bagaimana perjalananmu?</DialogTitle>
            <DialogDescription className="text-center">
              Beri penilaian untuk {order.driver?.name || "driver"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-2 py-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setStars(s)}
                className="transition-transform hover:scale-110 active:scale-95"
                aria-label={`Beri ${s} bintang`}
              >
                <Star size={34} className={s <= stars ? "fill-gold text-gold" : "text-gray-300"} />
              </button>
            ))}
          </div>
          <Textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Ulasan singkat (opsional)…"
            rows={2}
            className="mt-1"
          />
          <DialogFooter className="mt-2">
            <Button onClick={submitRating} disabled={busy || stars < 1} className="w-full bg-unp font-extrabold hover:bg-unp-dark">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Star size={15} className="fill-white" />}
              Kirim Rating
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
