"use client";

// Rute jalan dari OSRM publik (gratis) — dipakai bersama oleh detail pesanan
// penumpang, pratinjau pesanan driver, dan tampilan pesanan aktif driver.
// Gagal/timeout 6 detik → null (peta menggambar garis lurus antar titik).
//
// State berkunci "key": hasil rute lama otomatis diabaikan saat rute berubah,
// tanpa perlu reset state di dalam effect.

import { useEffect, useState } from "react";
import type { LatLng } from "./map-core";

export interface RouteInfo {
  /** Kunci rute (id pesanan + koordinat) — hasil dengan kunci beda diabaikan. */
  key: string;
  /** Garis rute jalan (GeoJSON OSRM → LatLng). */
  line: Array<LatLng>;
  /** Panjang rute dalam meter (0 bila OSRM tidak memberi). */
  meters: number;
  /** Estimasi durasi tempuh dalam detik (0 bila OSRM tidak memberi). */
  seconds: number;
}

export function useOsmrRoute(pickup: LatLng | null, dest: LatLng | null, orderKey: string | null): RouteInfo | null {
  const [info, setInfo] = useState<RouteInfo | null>(null);
  const key =
    pickup && dest && orderKey ? `${orderKey}|${pickup.lat},${pickup.lng}|${dest.lat},${dest.lng}` : null;
  const route = info && info.key === key ? info : null;

  useEffect(() => {
    if (!key || !pickup || !dest) return;
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`,
      { signal: ctrl.signal }
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("osrm"))))
      .then((j) => {
        if (cancelled) return;
        const coords = j?.routes?.[0]?.geometry?.coordinates as Array<[number, number]> | undefined;
        const meters = typeof j?.routes?.[0]?.distance === "number" ? j.routes[0].distance : null;
        const seconds = typeof j?.routes?.[0]?.duration === "number" ? j.routes[0].duration : null;
        if (coords?.length) {
          setInfo({
            key,
            line: coords.map(([lng, lat]) => ({ lat, lng })),
            meters: meters ?? 0,
            seconds: seconds ?? 0,
          });
        }
      })
      .catch(() => {
        // Rute tak tersedia → peta tetap menampilkan garis lurus antar titik.
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [key]);

  return route;
}
