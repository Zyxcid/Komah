"use client";

import { useMemo, useState } from "react";
import { Building2, Check, Home, MapPin, MousePointerClick, Search, Store } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { rupiah } from "./lib";
import { PinMap } from "./map-view";
import type { LocationT } from "@/lib/types";

const CATEGORY_META: Record<LocationT["category"], { label: string; icon: React.ElementType }> = {
  KAMPUS: { label: "Area Kampus", icon: Building2 },
  KOS: { label: "Kos & Tempat Tinggal", icon: Home },
  PUBLIK: { label: "Titik Publik", icon: Store },
};

export function LocationPicker({
  locations,
  value,
  onChange,
  label,
  placeholder = "Pilih lokasi",
}: {
  locations: LocationT[];
  value: LocationT | null;
  onChange: (loc: LocationT) => void;
  label: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  // Pilihan yang sedang diatur pin-nya (belum dikonfirmasi).
  const [pending, setPending] = useState<LocationT | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);

  const grouped = useMemo(() => {
    const filtered = locations.filter((l) => l.name.toLowerCase().includes(q.toLowerCase().trim()));
    const order: LocationT["category"][] = ["KAMPUS", "KOS", "PUBLIK"];
    return order
      .map((cat) => ({ cat, items: filtered.filter((l) => l.category === cat) }))
      .filter((g) => g.items.length > 0);
  }, [locations, q]);

  // Deteksi apakah pin sudah digeser dari koordinat asli lokasi (untuk info kecil).
  const origLoc = value ? locations.find((l) => l.id === value.id) : null;
  const pinMoved = !!(origLoc?.lat != null && value?.lat != null && origLoc.lat !== value.lat);

  function selectLoc(loc: LocationT) {
    setPending(loc);
    setPin(loc.lat != null && loc.lng != null ? { lat: loc.lat, lng: loc.lng } : null);
  }

  function confirm() {
    if (!pending) return;
    // Koordinat final = posisi pin (bila digeser), selain itu koordinat lokasi asli.
    onChange(pin ? { ...pending, lat: pin.lat, lng: pin.lng } : pending);
    setOpen(false);
    setPending(null);
    setPin(null);
    setQ("");
  }

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

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setPending(null); setPin(null); setQ(""); } }}>
        <DialogContent className="max-w-md gap-0 p-0 overflow-hidden max-h-[88vh] flex flex-col">
          <DialogHeader className="px-5 pt-5 pb-3 text-left shrink-0">
            <DialogTitle className="text-base">Pilih Lokasi</DialogTitle>
            <DialogDescription className="sr-only">Cari lokasi, lalu atur pin {label.toLowerCase()} di peta.</DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-3 shrink-0">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari lokasi… (cth: FT, Parkit, Kurao)"
                className="border-2 pl-10"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0 max-h-[38vh] border-t">
            <div className="px-3 py-3">
              {grouped.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">Lokasi tidak ditemukan.</p>
              )}
              {grouped.map(({ cat, items }) => {
                const Icon = CATEGORY_META[cat].icon;
                return (
                  <div key={cat} className="mb-2">
                    <p className="px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {CATEGORY_META[cat].label}
                    </p>
                    {items.map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => selectLoc(loc)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-unp-soft",
                          (pending?.id === loc.id || (!pending && value?.id === loc.id)) && "bg-unp-soft"
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-unp-soft text-unp">
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">{loc.name}</span>
                            {loc.isPopular && (
                              <span className="rounded-full bg-gold-soft px-1.5 py-0.5 text-[10px] font-bold text-gold-dark">Populer</span>
                            )}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {loc.category === "KAMPUS" ? "Tarif dasar" : `${rupiah(loc.fare)} dari kampus`}
                          </span>
                        </span>
                        {(pending?.id === loc.id || (!pending && value?.id === loc.id)) && <Check size={16} className="shrink-0 text-unp" />}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Peta pin presisi — muncul setelah lokasi dipilih */}
          {pending && pin && (
            <div className="shrink-0 space-y-2.5 border-t bg-muted/30 px-5 py-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <MousePointerClick size={14} className="text-unp" />
                Geser pin atau ketuk peta bila titiknya perlu lebih presisi (opsional)
              </p>
              <PinMap center={pin} value={pin} onChange={setPin} />
              <Button onClick={confirm} className="h-11 w-full gap-2 bg-unp font-extrabold hover:bg-unp-dark">
                <Check size={16} /> Gunakan: {pending.name}
              </Button>
            </div>
          )}
          {pending && !pin && (
            <DialogFooter className="shrink-0 border-t bg-muted/30 px-5 py-4">
              <Button onClick={confirm} className="h-11 w-full gap-2 bg-unp font-extrabold hover:bg-unp-dark">
                <Check size={16} /> Gunakan: {pending.name}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
