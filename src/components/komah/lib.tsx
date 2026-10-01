"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AddressT, LocationT, MeT, OrderStatus, OrderType } from "@/lib/types";

// ===================== Router hash sederhana =====================
export type Route =
  | { name: "landing" }
  | { name: "login" }
  | { name: "register" }
  | { name: "home" }
  | { name: "order"; type?: OrderType }
  | { name: "order-detail"; code: string }
  | { name: "history" }
  | { name: "driver-mode" }
  | { name: "admin-home" }
  | { name: "admin" }
  | { name: "admin-locations" }
  | { name: "profile" };

export function parseHash(): { route: Route; query: URLSearchParams } {
  const raw = typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, "");
  const [pathPart, queryPart] = raw.split("?");
  const query = new URLSearchParams(queryPart || "");
  const parts = (pathPart || "/").split("/").filter(Boolean);
  const head = parts[0] || "";

  switch (head) {
    case "":
      return { route: { name: "landing" }, query };
    case "masuk":
      return { route: { name: "login" }, query };
    case "daftar":
      return { route: { name: "register" }, query };
    case "beranda":
      return { route: { name: "home" }, query };
    case "pesan": {
      const t = query.get("type");
      const type: OrderType | undefined =
        t === "OJEK" || t === "BARANG" || t === "MAKANAN" ? t : undefined;
      return { route: { name: "order", type }, query };
    }
    case "pesanan":
      return { route: { name: "order-detail", code: parts[1] || "" }, query };
    case "riwayat":
      return { route: { name: "history" }, query };
    case "mode-driver":
      return { route: { name: "driver-mode" }, query };
    case "admin":
      return { route: { name: "admin-home" }, query };
    case "verifikasi":
      return { route: { name: "admin" }, query };
    case "kelola-lokasi":
      return { route: { name: "admin-locations" }, query };
    case "profil":
      return { route: { name: "profile" }, query };
    default:
      return { route: { name: "landing" }, query };
  }
}

export function navigate(path: string, replace = false) {
  const target = `#${path.startsWith("/") ? path : `/${path}`}`;
  if (replace) {
    window.history.replaceState(null, "", target);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = target;
  }
}

export function useRoute() {
  const [state, setState] = useState(() => parseHash());
  useEffect(() => {
    const onChange = () => {
      setState(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return state;
}

// ===================== Konteks autentikasi =====================
interface MeResponse {
  user: MeT | null;
  addresses: AddressT[];
  activeOrder: import("@/lib/types").OrderT | null;
}

interface AuthCtx {
  me: MeT | null;
  addresses: AddressT[];
  activeOrder: import("@/lib/types").OrderT | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  patchMe: (partial: Partial<MeT>) => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeT | null>(null);
  const [addresses, setAddresses] = useState<AddressT[]>([]);
  const [activeOrder, setActiveOrder] = useState<import("@/lib/types").OrderT | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data: MeResponse = await res.json();
      setMe(data.user);
      setAddresses(data.addresses || []);
      setActiveOrder(data.activeOrder || null);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Segarkan sesi berkala agar pesanan aktif & alamat selalu mutakhir
  const uid = me?.id;
  useEffect(() => {
    if (!uid) return;
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [uid, refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    setAddresses([]);
    setActiveOrder(null);
    navigate("/");
  }, []);

  const patchMe = useCallback((partial: Partial<MeT>) => {
    setMe((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ me, addresses, activeOrder, loading, refresh, logout, patchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}

// ===================== Prefill "Pesan lagi" / pintasan =====================
// Stash sementara di sessionStorage — menyimpan objek lokasi lengkap agar
// OrderFlow bisa menerapkannya langsung saat inisialisasi state (tanpa effect).
// Dihapus saat flow dilepas (unmount).
export interface OrderPrefill {
  type?: OrderType;
  pickup?: LocationT;
  dest?: LocationT;
  pickupDetail?: string;
  destDetail?: string;
  itemNote?: string;
  passengerNote?: string;
}

const PREFILL_KEY = "komah_prefill";

export function stashPrefill(p: OrderPrefill) {
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify(p));
  } catch {
    // sessionStorage tidak tersedia — abaikan saja, user mengisi manual.
  }
}

// Baca tanpa menghapus (aman terhadap double-mount StrictMode);
// hapus eksplisit lewat clearPrefill setelah benar-benar diterapkan.
export function readPrefill(): OrderPrefill | null {
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY);
    return raw ? (JSON.parse(raw) as OrderPrefill) : null;
  } catch {
    return null;
  }
}

export function clearPrefill() {
  try {
    sessionStorage.removeItem(PREFILL_KEY);
  } catch {
    // abaikan
  }
}

// ===================== Mode aplikasi (penumpang / driver) =====================
// Satu akun driver bisa berperan sebagai penumpang dan sebaliknya;
// appMode hanya menentukan halaman pembuka aplikasi.

export function effectiveMode(me: MeT | null): "PENUMPANG" | "DRIVER" {
  if (!me || me.role !== "DRIVER") return "PENUMPANG";
  // Driver yang sedang mengantar selalu dibuka di mode driver (fokus perjalanan).
  if (me.activeDrive) return "DRIVER";
  return me.appMode === "DRIVER" ? "DRIVER" : "PENUMPANG";
}

/** Halaman pembuka sesuai mode (admin tetap ke panelnya). */
export function modeHome(me: MeT | null): string {
  if (!me) return "/masuk";
  if (me.role === "ADMIN") return "/admin";
  if (me.role === "DRIVER") return effectiveMode(me) === "DRIVER" ? "/mode-driver" : "/beranda";
  return "/beranda";
}

/** Nama route beranda sesuai mode — untuk menandai tab aktif & tombol kembali. */
export function homeRouteName(me: MeT | null): string {
  if (!me) return "landing";
  if (me.role === "ADMIN") return "admin-home";
  if (me.role === "DRIVER") return effectiveMode(me) === "DRIVER" ? "driver-mode" : "home";
  return "home";
}

// ===================== Tautan chat WhatsApp =====================
// Tombol "telepon" di aplikasi membuka chat WA (bukan dialer) karena kolom
// nomor HP di KOMAH memang berlabel "No. HP (WhatsApp)". Nomor dinormalkan
// ke format 62xxx; pesan opsional terisi otomatis (mis. kode pesanan).
export function waLink(phone: string | null | undefined, message?: string) {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  const target = digits.startsWith("62") ? digits : digits.replace(/^0/, "62");
  if (target.length < 10 || target.length > 15) return null;
  return `https://wa.me/${target}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

// ===================== Fetch dengan polling =====================
export function useApi<T>(url: string | null, opts?: { interval?: number; enabled?: boolean }) {
  const interval = opts?.interval;
  const enabled = opts?.enabled !== false;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef(url);
  urlRef.current = url;

  const load = useCallback(async () => {
    if (!urlRef.current || enabled === false) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(urlRef.current, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal memuat data.");
      } else {
        setError(null);
        setData(json);
      }
    } catch {
      setError("Koneksi bermasalah.");
    } finally {
      setLoading(false);
    }
  }, [url, enabled]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!interval || enabled === false) return;
    const t = setInterval(load, interval);
    return () => clearInterval(t);
  }, [load, interval, enabled]);

  return { data, loading, error, refetch: load };
}

// ===================== Helper tampilan =====================
export function rupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

export function timeId(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function dateId(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function dateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - that.getTime()) / 86400000;
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Kemarin";
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
}

export const STATUS_META: Record<OrderStatus, { label: string; short: string; step: number }> = {
  MENCARI: { label: "Mencari driver terdekat", short: "Mencari Driver", step: 0 },
  DIKONFIRMASI: { label: "Driver menuju titik jemput", short: "Driver Ditemukan", step: 1 },
  BERJALAN: { label: "Dalam perjalanan", short: "Dalam Perjalanan", step: 2 },
  SELESAI: { label: "Pesanan selesai", short: "Selesai", step: 3 },
  DIBATALKAN: { label: "Pesanan dibatalkan", short: "Dibatalkan", step: -1 },
};

export const TYPE_META: Record<OrderType, { label: string; desc: string }> = {
  OJEK: { label: "Ojek", desc: "Antar kamu ke tujuan" },
  BARANG: { label: "Antar Barang", desc: "Titip antar barang di sela kuliah" },
  MAKANAN: { label: "Antar Makanan", desc: "Antar pesanan makanan & minuman" },
};

export const ACTIVE_STATUSES: OrderStatus[] = ["MENCARI", "DIKONFIRMASI", "BERJALAN"];

export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

/** Durasi tempuh (detik OSRM) → "12 mnt" / "1 jam 5 mnt". */
export function fmtDur(seconds: number) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  return `${h} jam ${m % 60} mnt`;
}

/** Jarak (meter OSRM) → "2,4 km". */
export function fmtKm(meters: number) {
  if (!meters || meters <= 0) return null;
  return `${(meters / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`;
}

/** Apakah penumpang menggeser pin jemput/tujuan dari koordinat lokasi asli. */
export function pinMoved(o: {
  pickupLat: number | null;
  destLat: number | null;
  pickupLocation: { lat: number | null };
  destLocation: { lat: number | null };
}) {
  return (
    (o.pickupLat != null && o.pickupLocation.lat != null && o.pickupLat !== o.pickupLocation.lat) ||
    (o.destLat != null && o.destLocation.lat != null && o.destLat !== o.destLocation.lat)
  );
}

export async function apiCall<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown
): Promise<{ ok: boolean; data: T & { error?: string; message?: string } }> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Gagal mengunggah.");
  return json.url as string;
}
