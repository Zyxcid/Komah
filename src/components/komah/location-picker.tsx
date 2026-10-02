"use client";

import { useMemo, useState } from "react";
import {
  BookmarkPlus,
  Building2,
  Check,
  Crosshair,
  Home,
  List,
  Loader2,
  MapPin,
  Search,
  Star,
  Store,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiCall, rupiah, useAuth } from "./lib";
import { PinMap } from "./map-view";
import type { AddressT, LocationT } from "@/lib/types";

const CATEGORY_META: Record<LocationT["category"], { label: string; icon: React.ElementType }> = {
  KAMPUS: { label: "Area Kampus", icon: Building2 },
  KOS: { label: "Kos & Tempat Tinggal", icon: Home },
  PUBLIK: { label: "Titik Publik", icon: Store },
};

// Pusat kampus UNP (fallback bila GPS tidak tersedia / ditolak).
const UNP_CENTER = { lat: -0.9009, lng: 100.3505 };

/** Lokasi terdekat dari sebuah titik — dipakai untuk menentukan zona tarif titik bebas. */
function nearestLocation(locs: LocationT[], p: { lat: number; lng: number }): LocationT | null {
  let best: LocationT | null = null;
  let bestD = Infinity;
  for (const l of locs) {
    if (l.lat == null || l.lng == null) continue;
    const d = (l.lat - p.lat) ** 2 + (l.lng - p.lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

type Tab = "peta" | "lokasi" | "alamat";

export function LocationPicker({
  locations,
  value,
  onChange,
  label,
  placeholder = "Pilih lokasi",
  addresses,
  onPickAddress,
}: {
  locations: LocationT[];
  value: LocationT | null;
  onChange: (loc: LocationT) => void;
  label: string;
  placeholder?: string;
  addresses?: AddressT[];
  onPickAddress?: (a: AddressT) => void;
}) {
  const { toast } = useToast();
  const { refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("peta");
  const [q, setQ] = useState("");

  // Pilihan yang sedang disusun (belum dikonfirmasi):
  // anchor = lokasi zona (nama & tarif), pin = koordinat persis di peta.
  const [pending, setPending] = useState<LocationT | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [custom, setCustom] = useState(false); // titik ditandai sendiri di peta

  // GPS
  const [locating, setLocating] = useState(false);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);

  // Simpan titik ke alamat tersimpan
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);

  const grouped = useMemo(() => {
    const filtered = locations.filter((l) => l.name.toLowerCase().includes(q.toLowerCase().trim()));
    const order: LocationT["category"][] = ["KAMPUS", "KOS", "PUBLIK"];
    return order
      .map((cat) => ({ cat, items: filtered.filter((l) => l.category === cat) }))
      .filter((g) => g.items.length > 0);
  }, [locations, q]);

  // Deteksi apakah pin sudah digeser dari koordinat asli lokasi (info kecil).
  const origLoc = value ? locations.find((l) => l.id === value.id) : null;
  const pinMoved = !!(origLoc?.lat != null && value?.lat != null && origLoc.lat !== value.lat);

  const center: { lat: number; lng: number } =
    myPos ||
    (value?.lat != null && value?.lng != null ? { lat: value.lat, lng: value.lng } : null) ||
    UNP_CENTER;

  function selectLoc(loc: LocationT) {
    setPending(loc);
    setCustom(false);
    setPin(loc.lat != null && loc.lng != null ? { lat: loc.lat, lng: loc.lng } : null);
    // Kembali ke peta agar pin lokasi terlihat — user bisa menggesernya
    // ke posisi sebenarnya sebelum konfirmasi (fungsi utama shortcut ini).
    if (loc.lat != null && loc.lng != null) setTab("peta");
  }

  function selectAddress(a: AddressT) {
    setPending(a.location);
    setCustom(false);
    setPin(a.location.lat != null && a.location.lng != null ? { lat: a.location.lat, lng: a.location.lng } : null);
    onPickAddress?.(a);
    // Langsung konfirmasi — alamat tersimpan sudah jelas pilihannya.
    confirm(a.location, a.location.lat != null && a.location.lng != null ? { lat: a.location.lat, lng: a.location.lng } : null);
  }

  /** Titik bebas dari peta (ketuk/GPS/geser) — zona mengikuti lokasi terdekat. */
  function pickPoint(p: { lat: number; lng: number }) {
    const anchor = nearestLocation(locations, p);
    setPin(p);
    if (anchor) {
      setPending({ ...anchor, lat: p.lat, lng: p.lng });
      setCustom(true);
    }
  }

  function useMyPosition() {
    if (!navigator.geolocation) {
      toast({ title: "GPS tidak tersedia", description: "Perangkat ini tidak mendukung geolokasi.", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyPos(p);
        pickPoint(p);
        setLocating(false);
      },
      () => {
        toast({ title: "Tidak bisa mendapat posisi", description: "Izinkan akses lokasi atau tandai titik manual di peta." });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function confirm(loc: LocationT | null, p: { lat: number; lng: number } | null) {
    if (!loc) return;
    onChange(p ? { ...loc, lat: p.lat, lng: p.lng } : loc);
    setOpen(false);
    reset();
  }

  function reset() {
    setPending(null);
    setPin(null);
    setCustom(false);
    setQ("");
    setTab("peta");
    setSaveOpen(false);
    setSaveLabel("");
  }

  async function saveAddress() {
    if (!pending || !saveLabel.trim()) return;
    setSaveBusy(true);
    const { ok, data } = await apiCall("/api/profile/addresses", "POST", {
      label: saveLabel.trim(),
      locationId: pending.id,
      detail: pin ? `Pin peta (${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)})` : "",
    });
    setSaveBusy(false);
    if (!ok) {
      toast({ title: "Gagal menyimpan alamat", description: data.error, variant: "destructive" });
      return;
    }
    await refresh();
    toast({ title: "Alamat tersimpan", description: "Bisa dipakai lagi lewat tab Alamat Tersimpan." });
    setSaveOpen(false);
    setSaveLabel("");
  }

  const tabs: Array<{ key: Tab; label: string; icon: React.ElementType; show: boolean }> = [
    { key: "peta", label: "Peta", icon: MapPin, show: true },
    { key: "lokasi", label: "Daftar Lokasi", icon: List, show: true },
    { key: "alamat", label: "Alamat Tersimpan", icon: Home, show: !!addresses },
  ];

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-foreground">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border-2 bg-card px-4 py-3.5 text-left transition-colors",
          value ? "border-unp/40 hover:border-unp" : "border-input hover:border-unp/50"
        )}
      >
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", value ? "bg-unp text-white" : "bg-muted text-muted-foreground")}>
          <MapPin size={17} />
        </span>
        <span className="min-w-0 flex-1">
          {value ? (
            <>
              <span className="block truncate text-sm font-bold text-foreground">{value.name}</span>
              <span className="block text-xs text-muted-foreground">
                {CATEGORY_META[value.category].label}
                {value.category !== "KAMPUS" && ` • ${rupiah(value.fare)} dari kampus`}
                {pinMoved && " • pin digeser"}
              </span>
            </>
          ) : (
            <span className="block text-sm text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <Search size={16} className="shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto p-0 max-w-md flex flex-col">
          <DialogHeader className="shrink-0 px-5 pt-5 pb-3 text-left">
            <DialogTitle className="text-base">Pilih {label}</DialogTitle>
            <DialogDescription className="sr-only">
              Tandai titik di peta, atau pilih dari daftar lokasi dan alamat tersimpan.
            </DialogDescription>
          </DialogHeader>

          {/* Peta hanya di tab Peta — setelah memilih dari daftar, tab pindah
              ke sini otomatis agar pin bisa digeser ke posisi sebenarnya. */}
          {tab === "peta" && (
            <div className="shrink-0 px-5">
              <PinMap center={center} value={pin} onChange={pickPoint} />
              {pending && pin && !custom && (
                <p className="mt-2 text-center text-[11px] leading-snug text-muted-foreground">
                  Geser pin bila posisimu berbeda, lalu konfirmasi di bawah.
                </p>
              )}
            </div>
          )}

          {/* Tab sumber titik */}
          <div className="shrink-0 px-5 pt-3">
            <div className="grid grid-cols-3 gap-2">
              {tabs.filter((t) => t.show).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  aria-pressed={tab === t.key}
                  className={cn(
                    "flex h-10 items-center justify-center gap-1.5 rounded-xl border-2 text-xs font-bold transition-colors",
                    tab === t.key
                      ? "border-unp bg-unp-soft text-unp-dark"
                      : "border-border bg-card text-muted-foreground hover:border-unp/40"
                  )}
                >
                  <t.icon size={14} />
                  {t.label}
                </button>
              ))}
            </div>
            {tab === "peta" && (
              <Button
                type="button"
                onClick={useMyPosition}
                disabled={locating}
                variant="outline"
                className="mt-2.5 h-10 w-full gap-2 border-2 text-xs font-bold"
              >
                {locating ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
                Gunakan posisiku saat ini
              </Button>
            )}
          </div>

          {/* Daftar lokasi / alamat tersimpan — scroll native (andal di layar sentuh) */}
          {tab === "lokasi" && (
            <div className="shrink-0 px-5 pt-3">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari lokasi… (cth: FT, Parkit, Kurao)"
                  className="h-10 border-2 pl-9 text-sm"
                />
              </div>
            </div>
          )}
          {tab !== "peta" && (
            <div className="max-h-72 overflow-y-auto overscroll-contain border-t">
              <div className="px-3 py-2.5">
                {tab === "lokasi" && grouped.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Lokasi tidak ditemukan.</p>
                )}
                {tab === "lokasi" &&
                  grouped.map(({ cat, items }) => {
                    const Icon = CATEGORY_META[cat].icon;
                    return (
                      <div key={cat} className="mb-1.5">
                        <p className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {CATEGORY_META[cat].label}
                        </p>
                        {items.map((loc) => (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() => selectLoc(loc)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-unp-soft",
                              pending?.id === loc.id && "bg-unp-soft"
                            )}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-unp-soft text-unp">
                              <Icon size={16} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold">{loc.name}</span>
                                {loc.isPopular && (
                                  <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-gold-soft px-1.5 py-0.5 text-[10px] font-bold text-gold-dark">
                                    <Star size={9} className="fill-gold-dark" /> Populer
                                  </span>
                                )}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {loc.category === "KAMPUS" ? "Tarif dasar" : `${rupiah(loc.fare)} dari kampus`}
                              </span>
                            </span>
                            {pending?.id === loc.id && <Check size={16} className="shrink-0 text-unp" />}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                {tab === "alamat" && (
                  <>
                    {(addresses || []).length === 0 && (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Belum ada alamat tersimpan. Tandai titik di peta lalu simpan.
                      </p>
                    )}
                    {(addresses || []).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => selectAddress(a)}
                        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-unp-soft"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-unp-soft text-unp">
                          {a.label.toLowerCase().includes("kos") ? <Home size={16} /> : <Star size={16} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {a.label} · {a.location.name}
                          </span>
                          {a.detail && <span className="block truncate text-xs text-muted-foreground">{a.detail}</span>}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Konfirmasi — menempel di bawah, selalu terlihat */}
          <div className="sticky bottom-0 mt-auto shrink-0 space-y-2 border-t bg-background/95 px-5 py-3.5 backdrop-blur">
            {saveOpen ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={saveLabel}
                  onChange={(e) => setSaveLabel(e.target.value)}
                  placeholder="Label alamat (cth: Kos, Fakultas)"
                  className="h-11 border-2"
                  onKeyDown={(e) => e.key === "Enter" && saveAddress()}
                />
                <Button onClick={saveAddress} disabled={saveBusy || !saveLabel.trim()} className="h-11 shrink-0 gap-1.5 bg-unp font-extrabold hover:bg-unp-dark">
                  {saveBusy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Simpan
                </Button>
              </div>
            ) : (
              <>
                <Button
                  onClick={() => confirm(pending, pin)}
                  disabled={!pending || !pin}
                  className="h-11 w-full gap-2 bg-unp font-extrabold hover:bg-unp-dark"
                >
                  <Check size={16} />
                  {pending && pin ? `Gunakan: ${pending.name}${custom ? " (titik peta)" : ""}` : "Tandai titik di peta dulu"}
                </Button>
                {pending && pin && custom && (
                  <button
                    type="button"
                    onClick={() => setSaveOpen(true)}
                    className="flex w-full items-center justify-center gap-1.5 text-xs font-bold text-unp hover:underline"
                  >
                    <BookmarkPlus size={13} /> Simpan titik ini ke alamat tersimpan
                  </button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
