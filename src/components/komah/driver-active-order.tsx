"use client";

// Tampilan pesanan aktif driver — mode FOKUS: hanya pesanan yang sedang
// berlangsung (dashboard menyembunyikan statistik & toggle online agar
// driver tidak mengambil pesanan kedua sebelum pesanan aktif selesai).
//
// Struktur meniru detail pesanan penumpang, namun kontennya disesuaikan alur
// kerja driver: hero status + stepper 2 langkah (menjemput → mengantar), tombol
// aksi utama LANGSUNG DI ATAS PETA (selalu terlihat tanpa scroll), kartu penumpang
// + tombol chat WhatsApp. Tanpa animasi denyut apa pun — tampilan tenang saat berkendara.

import { useMemo, useState } from "react";
import { Bike, Check, Clock, Loader2, MapPin, Navigation, MessageCircle, Route as RouteIcon, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { fmtDur, fmtKm, pinMoved, rupiah, waLink } from "./lib";
import { RouteMap } from "./map-view";
import { PointRow, TypeIcon, UserAvatar } from "./bits";
import { useOsmrRoute } from "./use-route";
import { WAITING_CHOICES, waitingSurcharge } from "@/lib/fare";
import type { LatLng } from "./map-core";
import type { OrderT } from "@/lib/types";

const UNP = "#C2410C";
const GOLD = "#F7A200";

export function DriverActiveOrder({
  order,
  onAct,
  busy,
}: {
  order: OrderT;
  onAct: (orderId: string, action: string, extra?: Record<string, unknown>) => void;
  busy: string | null;
}) {
  const isPicking = order.status === "DIKONFIRMASI";
  const busyThis = busy === order.id + (isPicking ? "start" : "complete");
  // Waktu tunggu (aturan Food Delivery) — dipilih driver sebelum menyelesaikan
  // pesanan makanan; server menghitung ulang total tarifnya.
  const [waiting, setWaiting] = useState(0);

  const pickupPos = useMemo<LatLng | null>(() => {
    if (order.pickupLat != null && order.pickupLng != null) return { lat: order.pickupLat, lng: order.pickupLng };
    if (order.pickupLocation.lat != null && order.pickupLocation.lng != null)
      return { lat: order.pickupLocation.lat, lng: order.pickupLocation.lng };
    return null;
  }, [order]);
  const destPos = useMemo<LatLng | null>(() => {
    if (order.destLat != null && order.destLng != null) return { lat: order.destLat, lng: order.destLng };
    if (order.destLocation.lat != null && order.destLocation.lng != null)
      return { lat: order.destLocation.lat, lng: order.destLocation.lng };
    return null;
  }, [order]);
  const driverPos = useMemo<LatLng | null>(
    () => (order.driverLat != null && order.driverLng != null ? { lat: order.driverLat, lng: order.driverLng } : null),
    [order]
  );

  const route = useOsmrRoute(pickupPos, destPos, order.id);
  const moved = pinMoved(order);

  // Stepper 2 langkah driver: Menjemput → Mengantar.
  const steps = ["Menjemput", "Mengantar"];
  const stepIdx = isPicking ? 0 : 1;

  return (
    <section className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-10 pt-6 sm:px-6">
      {/* Hero status */}
      <div className="rounded-3xl border-2 border-unp/30 bg-gradient-to-br from-unp-soft/70 to-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-unp px-3.5 py-1.5 text-sm font-extrabold text-white shadow-md">
            <TypeIcon type={order.type} size={15} className="text-white" />
            {order.code}
          </span>
          <span className="text-lg font-extrabold text-unp-dark">{rupiah(order.fare)}</span>
        </div>
        <h1 className="mt-3.5 flex items-center gap-2.5 text-xl font-extrabold text-unp-deep sm:text-2xl">
          {isPicking ? <MapPin size={24} className="text-unp" /> : <Navigation size={24} className="text-unp" />}
          {isPicking ? "Menuju Titik Jemput" : "Mengantar ke Tujuan"}
        </h1>

        {/* Stepper 2 langkah */}
        <div className="mt-4 flex items-center">
          {steps.map((s, i) => (
            <div key={s} className="flex min-w-0 items-center">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold transition-colors",
                    i < stepIdx ? "bg-gold text-unp-deep" : i === stepIdx ? "bg-gold text-unp-deep ring-4 ring-gold/30" : "bg-muted text-muted-foreground"
                  )}
                >
                  {i < stepIdx ? <Check size={14} /> : <span className="tabular-nums">{i + 1}</span>}
                </span>
                <span
                  className={cn(
                    "truncate text-[11px] font-bold sm:text-xs",
                    i <= stepIdx ? "text-unp-dark" : "text-muted-foreground"
                  )}
                >
                  {s}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={cn("mx-2.5 h-1 w-5 shrink-0 rounded-full sm:mx-4 sm:w-10", i < stepIdx ? "bg-gold" : "bg-muted")} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Aksi utama — DI ATAS peta agar selalu terlihat tanpa scroll */}
      {isPicking ? (
        <div className="space-y-2.5">
          <Button
            onClick={() => onAct(order.id, "start")}
            disabled={busyThis}
            className="h-14 w-full gap-2 bg-gold text-base font-extrabold hover:bg-gold-dark"
          >
            {busyThis ? <Loader2 size={18} className="animate-spin" /> : <Bike size={18} />}
            Penumpang Sudah Naik
          </Button>
          {/* Darurat driver: tidak bisa menjemput → kembalikan pesanan ke
              pencarian driver lain (penumpang diberi tahu, tidak hangus). */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={busy === order.id + "driver-cancel"}
                className="h-11 w-full gap-2 border-2 border-red-200 font-bold text-red-600 hover:bg-red-50 hover:text-red-600"
              >
                <X size={15} /> Tidak Bisa Menjemput — Kembalikan
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Kembalikan pesanan {order.code}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Pesanan kembali dicarikan driver lain dan penumpang akan diberi tahu. Gunakan hanya bila benar-benar tidak bisa menjemput (kendaraan bermasalah, keadaan mendesak, dsb.).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Lanjutkan Pesanan</AlertDialogCancel>
                <AlertDialogAction onClick={() => onAct(order.id, "driver-cancel")} className="bg-red-600 hover:bg-red-700">
                  Ya, Kembalikan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : (
        <div className="space-y-3">
          {order.type === "MAKANAN" && (
            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <p className="flex items-center gap-1.5 text-sm font-extrabold">
                <Clock size={15} className="text-unp" /> Waktu tunggu di tempat pembelian
              </p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                Sesuai aturan resmi: ≥7 menit +Rp1.000, bertambah tiap tingkatan.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {WAITING_CHOICES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setWaiting(m)}
                    aria-pressed={waiting === m}
                    className={cn(
                      "rounded-xl border-2 px-3 py-2 text-xs font-bold transition-colors",
                      waiting === m
                        ? "border-unp bg-unp-soft text-unp-dark"
                        : "border-border bg-card text-muted-foreground hover:border-unp/40"
                    )}
                  >
                    {m === 0 ? "Tidak menunggu" : `${m} mnt${waitingSurcharge(m) ? ` (+${rupiah(waitingSurcharge(m))})` : ""}`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button
            onClick={() => onAct(order.id, "complete", order.type === "MAKANAN" ? { waitingMinutes: waiting } : undefined)}
            disabled={busyThis}
            className="h-14 w-full gap-2 bg-gold text-base font-extrabold text-unp-deep hover:bg-gold-dark"
          >
            {busyThis ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            Selesaikan Pesanan (+{rupiah(order.fare - 1000 + (order.type === "MAKANAN" ? waitingSurcharge(waiting) : 0))})
          </Button>
        </div>
      )}

      {/* Peta rute + posisi driver sendiri */}
      {pickupPos && destPos && (
        <RouteMap pickup={pickupPos} dest={destPos} driver={driverPos} route={route?.line || null} />
      )}
      {route && (route.meters > 0 || route.seconds > 0) && (
        <p className="-mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <RouteIcon size={13} className="text-unp" />
          {[fmtDur(route.seconds), fmtKm(route.meters)].filter(Boolean).join(" • ") || "Rute tersedia"}
        </p>
      )}

      {/* Titik jemput & tujuan */}
      <div className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <PointRow
          color={UNP}
          label="Titik jemput"
          name={order.pickupLocation.name}
          detail={order.pickupDetail}
        />
        <div className="ml-[3px] h-6 w-0.5 rounded-full bg-gradient-to-b from-unp to-gold" aria-hidden />
        <PointRow
          color={GOLD}
          label="Tujuan"
          name={order.destLocation.name}
          detail={order.destDetail}
        />
        {order.itemNote && (
          <p className="rounded-xl bg-gold-soft/60 px-3.5 py-2.5 text-sm font-semibold text-gold-dark">
            {order.type === "MAKANAN" ? "Makanan" : "Barang"}: {order.itemNote}
          </p>
        )}
        {order.type === "MAKANAN" && (
          <p className="text-xs text-muted-foreground">
            {order.portions ?? 1} porsi • {order.places ?? 1} tempat pembelian
            {order.rain ? " • hujan" : ""}
          </p>
        )}
        {order.passengerNote && (
          <p className="rounded-xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">Catatan: {order.passengerNote}</p>
        )}
        <div className="flex items-center justify-between border-t border-border pt-3.5 text-sm">
          <span className="text-muted-foreground">Pembayaran</span>
          <span className="font-extrabold text-unp">{rupiah(order.fare)} (tunai)</span>
        </div>
      </div>

      {/* Penumpang + chat WhatsApp */}
      {order.user && (
        <div className="flex items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <UserAvatar name={order.user.name} url={order.user.avatarUrl} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">{order.user.name}</p>
              <p className="text-[11px] text-muted-foreground">Penumpang terverifikasi civitas</p>
            </div>
          </div>
          {order.user.phone && (
            <a
              href={waLink(order.user.phone, `Halo, saya driver KOMAH untuk pesanan ${order.code}.`) || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-unp text-white shadow-md transition-transform hover:scale-105"
              aria-label={`Chat WhatsApp ${order.user.name}`}
            >
              <MessageCircle size={17} />
            </a>
          )}
        </div>
      )}
    </section>
  );
}
