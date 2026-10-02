"use client";

import { useMemo, useState } from "react";
import {
  BookmarkPlus,
  Building2,
  Check,
  ChevronDown,
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
import { PIN_DETAIL_RE, apiCall, parsePinDetail, pinDetail, rupiah, useAuth } from "./lib";
import { PinMap } from "./map-view";
import type { AddressT, LocationT } from "@/lib/types";

const CATEGORY_META: Record<LocationT["category"], { label: string; icon: React.ElementType }> = {
  KAMPUS: { label: "Area Kampus", icon: Building2 },
  KOS: { label: "Kos & Tempat Tinggal", icon: Home },
  PUBLIK: { label: "Titik Publik", icon: Store },
};

// Pusat kampus UNP (posisi awal peta).
const UNP_CENTER = { lat: -0.9009, lng: 100.3505 };

type ListView = "lokasi" | "alamat";

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
  // null = hanya peta; "lokasi"/"alamat" = daftar terbuka lewat shortcut.
  const [listView, setListView] = useState<ListView | null>(null);
  const [q, setQ] = useState("");

  // Pilihan yang sedang disusun (belum dikonfirmasi):
  // pending = lokasi zona (nama & tarif), pin = koordinat persis di peta.
  const [pending, setPending] = useState<LocationT | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);

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

  // Pin digeser dari koordinat asli lokasi → tawarkan simpan sebagai alamat.
  const pinMoved = !!(
    pending &&
    pin &&
    pending.lat != null &&
    pending.lng != null &&
    (pin.lat !== pending.lat || pin.lng !== pending.lng)
  );

  // Buka dialog: mulai dari pilihan saat ini (bila sudah pernah dipilih).
  function openDialog() {
    setPending(value ?? null);
    setPin(value?.lat != null && value?.lng != null ? { lat: value.lat, lng: value.lng } : null);
    setOpen(true);
  }

  // Lokasi terdekat dari sebuah titik — zona & tarif mengikuti pin.
  // (Jarak bidang sederhana; akurat untuk skala kampus.)
  function nearestLoc(p: { lat: number; lng: number }): LocationT | null {
    let best: LocationT | null = null;
    let bestD = Infinity;
    const k = Math.cos((p.lat * Math.PI) / 180);
    for (const l of locations) {
      if (l.lat == null || l.lng == null) continue;
      const d = (l.lat - p.lat) ** 2 + ((l.lng - p.lng) * k) ** 2;
      if (d < bestD) {
        bestD = d;
        best = l;
      }
    }
    return best;
  }

  // Ketuk / geser pin: pin menandai titik persis, lokasi (zona) mengikuti
  // titik terdekat — tombol konfirmasi selalu menunjukkan lokasinya.
  function movePin(p: { lat: number; lng: number }) {
    setPin(p);
    const near = nearestLoc(p);
    if (near) setPending(near);
  }

  function selectLoc(loc: LocationT) {
    setPending(loc);
    setPin(loc.lat != null && loc.lng != null ? { lat: loc.lat, lng: loc.lng } : null);
    setListView(null); // kembali ke peta untuk penyesuaian pin
  }

  function selectAddress(a: AddressT) {
    // Pulihkan pin persis yang tersimpan (bila ada). Koordinat tidak
    // diteruskan sebagai detail — itu data internal, bukan teks user.
    const saved =
      parsePinDetail(a.detail) ??
      (a.location.lat != null && a.location.lng != null ? { lat: a.location.lat, lng: a.location.lng } : null);
    onPickAddress?.({ ...a, detail: PIN_DETAIL_RE.test(a.detail ?? "") ? null : a.detail });
    // Langsung konfirmasi — alamat tersimpan sudah jelas pilihannya.
    confirm(a.location, saved);
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
    setQ("");
    setListView(null);
    setSaveOpen(false);
    setSaveLabel("");
  }

  async function saveAddress() {
    if (!pending || !saveLabel.trim()) return;
    setSaveBusy(true);
    const { ok, data } = await apiCall("/api/profile/addresses", "POST", {
      label: saveLabel.trim(),
      locationId: pending.id,
      detail: pin ? pinDetail(pin) : "",
    });
    setSaveBusy(false);
    if (!ok) {
      toast({ title: "Gagal menyimpan alamat", description: data.error, variant: "destructive" });
      return;
    }
    await refresh();
    toast({ title: "Alamat tersimpan", description: "Bisa dipakai lagi lewat Alamat Tersimpan." });
    setSaveOpen(false);
    setSaveLabel("");
  }

  const shortcuts: Array<{ key: ListView; label: string; icon: React.ElementType }> = [
    { key: "lokasi", label: "Daftar Lokasi", icon: List },
    ...(addresses ? [{ key: "alamat" as const, label: "Alamat Tersimpan", icon: Home }] : []),
  ];

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-foreground">{label}</label>
      <button
        type="button"
        onClick={openDialog}
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
          <DialogHeader className="shrink-0 px-5 pt-4 pb-2.5 text-left">
            <DialogTitle className="text-base">Pilih {label}</DialogTitle>
            <DialogDescription className="sr-only">
              Ketuk peta untuk menandai titik, atau buka daftar lokasi dan alamat tersimpan.
            </DialogDescription>
          </DialogHeader>

          {/* Peta tampil lebih dulu — pin bisa diketuk/digeser ke posisi sebenarnya. */}
          <div className="shrink-0 px-5">
            <PinMap
              className={listView ? "h-44 sm:h-44" : "h-[340px] sm:h-[340px]"}
              center={value?.lat != null && value?.lng != null ? { lat: value.lat, lng: value.lng } : UNP_CENTER}
              value={pin}
              onChange={movePin}
            />
          </div>

          {/* Shortcut daftar — daftar muncul di bawah peta saat diketuk. */}
          <div className={cn("flex gap-2 px-5 py-3", addresses && "grid grid-cols-2")}>
            {shortcuts.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setListView(listView === s.key ? null : s.key)}
                aria-pressed={listView === s.key}
                className={cn(
                  "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 text-xs font-bold transition-colors",
                  listView === s.key
                    ? "border-unp bg-unp-soft text-unp-dark"
                    : "border-border bg-card text-muted-foreground hover:border-unp/40"
                )}
              >
                <s.icon size={14} />
                {s.label}
                <ChevronDown size={13} className={cn("transition-transform", listView === s.key && "rotate-180")} />
              </button>
            ))}
          </div>

          {/* Daftar lokasi / alamat tersimpan — hanya saat shortcut aktif. */}
          {listView && (
            <div className="shrink-0 border-t">
              {listView === "lokasi" && (
                <div className="px-5 pt-3">
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
              <div className="overscroll-contain max-h-64 overflow-y-auto">
                <div className="px-3 py-2.5">
                  {listView === "lokasi" && grouped.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">Lokasi tidak ditemukan.</p>
                  )}
                  {listView === "lokasi" &&
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
                  {listView === "alamat" && (
                    <>
                      {(addresses || []).length === 0 && (
                        <p className="py-6 text-center text-sm text-muted-foreground">Belum ada alamat tersimpan.</p>
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
                            {a.detail && !PIN_DETAIL_RE.test(a.detail) && (
                              <span className="block truncate text-xs text-muted-foreground">{a.detail}</span>
                            )}
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
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
                  disabled={!pending}
                  className="h-11 w-full gap-2 bg-unp font-extrabold hover:bg-unp-dark"
                >
                  <Check size={16} />
                  {pending ? `Gunakan: ${pending.name}` : "Pilih lokasi dulu"}
                </Button>
                {pinMoved && (
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
