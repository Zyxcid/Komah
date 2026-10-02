"use client";

// Pratinjau pesanan masuk untuk driver — titik yang ditandai penumpang di peta
// diperlihatkan SEBELUM pesanan diterima, lengkap dengan rute jalan, catatan,
// dan profil penumpang. Terima/tolak dari tombol menempel di bawah dialog.

import { useMemo } from "react";
import { BadgeCheck, Loader2, MapPin, MessageCircle, Route as RouteIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fmtDur, fmtKm, rupiah, timeId, waLink } from "./lib";
import { RouteMap } from "./map-view";
import { PointRow, TypeIcon, UserAvatar } from "./bits";
import { useOsmrRoute } from "./use-route";
import type { LatLng } from "./map-core";
import type { OrderT } from "@/lib/types";

const UNP = "#0E7A3E";
const GOLD = "#F5B301";

export function DriverOrderPreview({
  order,
  open,
  onOpenChange,
  onAccept,
  busy,
}: {
  order: OrderT | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAccept: (order: OrderT) => void;
  busy: boolean;
}) {
  const pickupPos = useMemo<LatLng | null>(() => {
    if (!order) return null;
    if (order.pickupLat != null && order.pickupLng != null) return { lat: order.pickupLat, lng: order.pickupLng };
    if (order.pickupLocation.lat != null && order.pickupLocation.lng != null)
      return { lat: order.pickupLocation.lat, lng: order.pickupLocation.lng };
    return null;
  }, [order]);
  const destPos = useMemo<LatLng | null>(() => {
    if (!order) return null;
    if (order.destLat != null && order.destLng != null) return { lat: order.destLat, lng: order.destLng };
    if (order.destLocation.lat != null && order.destLocation.lng != null)
      return { lat: order.destLocation.lat, lng: order.destLocation.lng };
    return null;
  }, [order]);

  const route = useOsmrRoute(pickupPos, destPos, open && order ? order.id : null);

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 max-h-[88vh] flex flex-col">
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <TypeIcon type={order.type} size={17} />
            {order.code}
            <span className="text-xs font-semibold text-muted-foreground">{timeId(order.createdAt)} WIB</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Periksa titik jemput &amp; tujuan yang ditandai penumpang sebelum menerima.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
          {/* Peta rute + titik yang ditandai penumpang */}
          {pickupPos && destPos && <RouteMap pickup={pickupPos} dest={destPos} route={route?.line || null} />}
          {route && (route.meters > 0 || route.seconds > 0) && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <RouteIcon size={13} className="text-unp" />
              {[fmtDur(route.seconds), fmtKm(route.meters)].filter(Boolean).join(" • ") || "Rute tersedia"}
            </p>
          )}

          <div className="space-y-3.5 rounded-2xl border border-border bg-card p-4">
            <PointRow
              color={UNP}
              label="Titik jemput"
              name={order.pickupLocation.name}
              detail={order.pickupDetail}
              moved={order.pickupLat != null && order.pickupLocation.lat != null && order.pickupLat !== order.pickupLocation.lat}
            />
            <PointRow
              color={GOLD}
              label="Tujuan"
              name={order.destLocation.name}
              detail={order.destDetail}
              moved={order.destLat != null && order.destLocation.lat != null && order.destLat !== order.destLocation.lat}
            />
            <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">Tarif (tunai)</span>
              <span className="font-extrabold text-unp">{rupiah(order.fare)}</span>
            </div>
          </div>

          {order.itemNote && (
            <p className="rounded-xl bg-gold-soft/60 px-3.5 py-2.5 text-sm font-semibold text-gold-dark">
              {order.type === "MAKANAN" ? "Makanan" : "Barang"}: {order.itemNote}
            </p>
          )}
          {order.passengerNote && (
            <p className="rounded-xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">Catatan: {order.passengerNote}</p>
          )}

          {/* Penumpang */}
          {order.user && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <UserAvatar name={order.user.name} url={order.user.avatarUrl} size={36} />
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
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-unp text-white shadow-md transition-transform hover:scale-105"
                  aria-label={`Chat WhatsApp ${order.user.name}`}
                >
                  <MessageCircle size={16} />
                </a>
              )}
            </div>
          )}

          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MapPin size={12} className="text-unp" />
            Pin mengikuti titik yang ditandai penumpang, perhatikan detailnya.
          </p>
        </div>

        {/* Aksi — sticky di bawah dialog agar selalu terlihat tanpa scroll */}
        <div className="sticky bottom-0 shrink-0 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
          <Button
            onClick={() => onAccept(order)}
            disabled={busy}
            className="h-12 w-full gap-2 bg-unp font-extrabold hover:bg-unp-dark"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
            Terima Pesanan (+{rupiah(order.fare - 1000)})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
