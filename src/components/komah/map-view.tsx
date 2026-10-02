"use client";

// Pembungkus peta: Leaflet hanya boleh dimuat di browser (ssr: false).
// Semua pemakaian peta di aplikasi cukup import dari file ini.

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import type { PinMapProps, RouteMapProps } from "./map-core";

function MapSkeleton() {
  return <div className="h-full w-full animate-pulse bg-muted" />;
}

const RouteMapCore = dynamic(() => import("./map-core").then((m) => m.RouteMapCore), {
  ssr: false,
  loading: MapSkeleton,
});

const PinMapCore = dynamic(() => import("./map-core").then((m) => m.PinMapCore), {
  ssr: false,
  loading: MapSkeleton,
});

/** Peta rute penuh — detail pesanan (dengan posisi driver) & pratinjau konfirmasi. */
export function RouteMap(props: RouteMapProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border shadow-sm">
      <div className="h-56 w-full sm:h-64">
        <RouteMapCore {...props} />
      </div>
    </div>
  );
}

/** Peta kecil dengan pin yang bisa digeser — di dalam dialog pemilih lokasi. */
export function PinMap({ className, ...props }: PinMapProps & { className?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-border">
      <div className={cn("h-52 w-full sm:h-56", className)}>
        <PinMapCore {...props} />
      </div>
    </div>
  );
}
