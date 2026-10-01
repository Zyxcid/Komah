"use client";

import { Bike, CheckCircle2, Package, Star, UtensilsCrossed, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials, STATUS_META, TYPE_META } from "./lib";
import type { OrderStatus, OrderType } from "@/lib/types";

export function LogoKOMAH({ dark = false, size = "md" }: { dark?: boolean; size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "h-8 w-8 rounded-lg" : size === "lg" ? "h-12 w-12 rounded-2xl" : "h-10 w-10 rounded-xl";
  const icon = size === "sm" ? 16 : size === "lg" ? 26 : 20;
  const text = size === "sm" ? "text-lg" : size === "lg" ? "text-2xl" : "text-xl";
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn("relative flex items-center justify-center bg-gradient-to-br from-unp to-unp-dark shadow-md shrink-0", box)}>
        <Bike size={icon} className="text-white" strokeWidth={2.4} />
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-white" aria-hidden />
      </div>
      <div className="leading-none">
        <div className={cn("font-extrabold tracking-tight", text, dark ? "text-white" : "text-unp-deep")}>
          KOMAH
        </div>
        <div className={cn("mt-1 text-[10px] font-semibold uppercase tracking-widest", dark ? "text-green-200/80" : "text-unp/70")}>
          Ojek &middot; Antar &middot; UNP
        </div>
      </div>
    </div>
  );
}

export function UserAvatar({
  name,
  url,
  className,
  size = 40,
}: {
  name: string;
  url?: string | null;
  className?: string;
  size?: number;
}) {
  const palette = ["#0E7A3E", "#C98F00", "#07451F", "#2E8B57", "#B8860B", "#3CB371"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  const color = palette[hash % palette.length];
  if (url) {
    return (
      <img
        src={url}
        alt={`Foto ${name}`}
        className={cn("rounded-full object-cover ring-2 ring-white shadow-sm", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={cn("flex items-center justify-center rounded-full font-bold text-white ring-2 ring-white shadow-sm", className)}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}CC)`, fontSize: size * 0.36 }}
      aria-label={`Avatar ${name}`}
    >
      {initials(name)}
    </div>
  );
}

export function RatingStars({ value, count, size = 14, className }: { value: number; count?: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Star size={size} className="fill-gold text-gold" />
      <span className="text-sm font-bold text-foreground">{value > 0 ? value.toFixed(1) : "Baru"}</span>
      {typeof count === "number" && count > 0 && <span className="text-xs text-muted-foreground">({count})</span>}
    </span>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  const map: Record<OrderStatus, string> = {
    MENCARI: "bg-amber-50 text-amber-700 border-amber-200",
    DIKONFIRMASI: "bg-blue-50 text-blue-700 border-blue-200",
    BERJALAN: "bg-unp-soft text-unp-dark border-green-200",
    SELESAI: "bg-green-50 text-unp border-green-200",
    DIBATALKAN: "bg-red-50 text-red-600 border-red-200",
  };
  const icon =
    status === "SELESAI" ? <CheckCircle2 size={13} /> :
    status === "DIBATALKAN" ? <XCircle size={13} /> :
    null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold", map[status])}>
      {icon}
      {meta.short}
    </span>
  );
}

export function TypeIcon({ type, size = 18, className }: { type: OrderType; size?: number; className?: string }) {
  const map = {
    OJEK: Bike,
    BARANG: Package,
    MAKANAN: UtensilsCrossed,
  } as const;
  const Icon = map[type];
  return <Icon size={size} className={cn("text-unp", className)} strokeWidth={2.2} />;
}

export function TypeBadge({ type }: { type: OrderType }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-unp-soft px-2.5 py-1 text-xs font-bold text-unp-dark">
      <TypeIcon type={type} size={13} />
      {TYPE_META[type].label}
    </span>
  );
}

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-unp-soft px-2 py-0.5 text-[11px] font-bold text-unp-dark", className)}>
      <CheckCircle2 size={12} />
      Terverifikasi KTM
    </span>
  );
}

export function OnlineDot({ online }: { online: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
      <span className={cn("relative flex h-2.5 w-2.5 rounded-full", online ? "bg-green-500 text-green-500" : "bg-gray-300 text-gray-300", online && "pulse-ring")} />
      {online ? <span className="text-unp-dark">Online</span> : <span className="text-muted-foreground">Offline</span>}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-unp-soft text-unp">{icon}</div>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{desc}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
