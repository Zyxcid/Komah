"use client";

// Tampilan pesanan aktif driver — mode FOKUS: hanya pesanan yang sedang
// berlangsung (dashboard menyembunyikan statistik & toggle online agar
// driver tidak mengambil pesanan kedua sebelum pesanan aktif selesai).
//
// Struktur meniru detail pesanan penumpang, namun kontennya disesuaikan alur
// kerja driver: hero status + stepper 2 langkah (menjemput → mengantar), tombol
// aksi utama LANGSUNG DI ATAS PETA (selalu terlihat tanpa scroll), kartu penumpang
// + tombol chat WhatsApp. Tanpa animasi denyut apa pun — tampilan tenang saat berkendara.

import { useMemo } from "react";
import { Bike, Check, Loader2, MapPin, Navigation, MessageCircle, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtDur, fmtKm, pinMoved, rupiah, waLink } from "./lib";
import { RouteMap } from "./map-view";
import { PointRow, TypeIcon, UserAvatar } from "./bits";
import { useOsmrRoute } from "./use-route";
import type { LatLng } from "./map-core";
import type { OrderT } from "@/lib/types";

const UNP = "#0E7A3E";
const GOLD = "#F5B301";

export function DriverActiveOrder({
  order,
  onAct,
  busy,
}: {
  order: OrderT;
  onAct: (orderId: string, action: string) => void;
  busy: string | null;
}) {
  const isPicking = order.status === "DIKONFIRMASI";
  const busyThis = busy === order.id + (isPicking ? "start" : "complete");

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
                    i < stepIdx ? "bg-unp text-white" : i === stepIdx ? "bg-unp text-white ring-4 ring-unp/20" : "bg-muted text-muted-foreground"
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
                <div className={cn("mx-2.5 h-1 w-5 shrink-0 rounded-full sm:mx-4 sm:w-10", i < stepIdx ? "bg-unp" : "bg-muted")} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Aksi utama — DI ATAS peta agar selalu terlihat tanpa scroll */}
      {isPicking ? (
        <Button
          onClick={() => onAct(order.id, "start")}
          disabled={busyThis}
          className="h-14 w-full gap-2 bg-unp text-base font-extrabold hover:bg-unp-dark"
        >
          {busyThis ? <Loader2 size={18} className="animate-spin" /> : <Bike size={18} />}
          Penumpang Sudah Naik
        </Button>
      ) : (
        <Button
          onClick={() => onAct(order.id, "complete")}
          disabled={busyThis}
          className="h-14 w-full gap-2 bg-gold text-base font-extrabold text-unp-deep hover:bg-gold-dark hover:text-white"
        >
          {busyThis ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          Selesaikan Pesanan (+{rupiah(order.fare - 1000)})
        </Button>
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

      {/* Titik jemput & tujuan (lencana bila pin digeser penumpang) */}
      <div className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <PointRow
          color={UNP}
          label="Titik jemput"
          name={order.pickupLocation.name}
          detail={order.pickupDetail}
          moved={order.pickupLat != null && order.pickupLocation.lat != null && order.pickupLat !== order.pickupLocation.lat}
        />
        <div className="ml-[3px] h-6 w-0.5 rounded-full bg-gradient-to-b from-unp to-gold" aria-hidden />
        <PointRow
          color={GOLD}
          label="Tujuan"
          name={order.destLocation.name}
          detail={order.destDetail}
          moved={order.destLat != null && order.destLocation.lat != null && order.destLat !== order.destLocation.lat}
        />
        {order.itemNote && (
          <p className="rounded-xl bg-gold-soft/60 px-3.5 py-2.5 text-sm font-semibold text-gold-dark">
            {order.type === "MAKANAN" ? "Makanan" : "Barang"}: {order.itemNote}
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
