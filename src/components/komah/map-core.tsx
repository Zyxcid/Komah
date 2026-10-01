"use client";

// ===================== Peta KOMAH (Leaflet + OpenStreetMap) =====================
// Dimuat lewat next/dynamic dengan ssr:false (lihat map-view.tsx) karena
// Leaflet memerlukan window. Tile & rute gratis: OpenStreetMap + OSRM publik.

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteMapProps {
  pickup: LatLng;
  dest: LatLng;
  driver?: LatLng | null;
  /** Titik rute jalan (hasil OSRM); null → garis lurus antar titik. */
  route?: LatLng[] | null;
}

export interface PinMapProps {
  center: LatLng;
  /** Posisi pin; null = belum ada pin (peta siap diketuk). */
  value: LatLng | null;
  onChange?: (p: LatLng) => void;
}

// ---------- Ikon marker (divIcon HTML — tanpa aset gambar) ----------

const UNP = "#0E7A3E";
const GOLD = "#F5B301";

function dotIcon(bg: string, size = 26) {
  const inner = Math.max(6, Math.round(size * 0.3));
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html:
      `<div style="position:relative;width:${size}px;height:${size}px">` +
      `<div style="position:absolute;inset:0;border-radius:9999px;background:${bg};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>` +
      `<div style="position:absolute;left:50%;top:50%;width:${inner}px;height:${inner}px;margin:-${inner / 2}px 0 0 -${inner / 2}px;border-radius:9999px;background:#fff"></div>` +
      `</div>`,
  });
}

const pickupIcon = dotIcon(UNP, 28);
const destIcon = dotIcon(GOLD, 28);

const driverIcon = L.divIcon({
  className: "",
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  html:
    `<div class="komah-driver-marker" style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:9999px;background:#fff;border:3px solid ${UNP};box-shadow:0 3px 10px rgba(0,0,0,.35)">` +
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${UNP}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 19-9-9 19-2-8-8-2z"/></svg>` +
    `</div>`,
});

// ---------- Util kecil di dalam peta ----------

/** Sesuaikan ukuran peta setelah mount (penting di dalam Dialog yang dianimasikan). */
function ResizeOnMount() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

/** Pas-kan viewport ke sekumpulan titik — hanya saat kumpulan titiknya berubah. */
function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  const signature = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
  useEffect(() => {
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [30, 30] });
  }, [map, signature]);
  return null;
}

/** Klik peta → pindahkan pin. */
function ClickToPick({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

// ---------- Peta rute (detail pesanan & pratinjau konfirmasi) ----------

export function RouteMapCore({ pickup, dest, driver, route }: RouteMapProps) {
  const hasRoute = !!route && route.length > 1;
  const line: LatLng[] = hasRoute ? route! : [pickup, dest];
  // Fit hanya saat susunan titik berubah (munculnya driver) — bukan tiap gerakan.
  const fitPoints = driver ? [pickup, dest, driver] : [pickup, dest];

  return (
    <MapContainer
      center={[(pickup.lat + dest.lat) / 2, (pickup.lng + dest.lng) / 2]}
      zoom={15}
      scrollWheelZoom={false}
      className="h-full w-full"
      style={{ background: "#e7efe9" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline
        positions={line.map((p) => [p.lat, p.lng] as [number, number])}
        pathOptions={
          hasRoute
            ? { color: UNP, weight: 4, opacity: 0.85 }
            : { color: UNP, weight: 3, opacity: 0.65, dashArray: "6 9" }
        }
      />
      <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />
      <Marker position={[dest.lat, dest.lng]} icon={destIcon} />
      {driver && <Marker position={[driver.lat, driver.lng]} icon={driverIcon} zIndexOffset={1000} />}
      <FitBounds points={fitPoints} />
      <ResizeOnMount />
    </MapContainer>
  );
}

// ---------- Peta pin geser (pemilih lokasi) ----------

export function PinMapCore({ center, value, onChange }: PinMapProps) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={16} scrollWheelZoom={false} className="h-full w-full" style={{ background: "#e7efe9" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={pickupIcon}
          draggable
          autoPan
          eventHandlers={{
            dragend: (e) => {
              const p = (e.target as L.Marker).getLatLng();
              onChange?.({ lat: p.lat, lng: p.lng });
            },
          }}
        />
      )}
      <ClickToPick onPick={(p) => onChange?.(p)} />
      <FitBounds points={[value || center]} />
      <ResizeOnMount />
    </MapContainer>
  );
}
