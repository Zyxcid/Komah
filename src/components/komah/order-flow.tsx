"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bike,
  Check,
  Loader2,
  MapPin,
  Package,
  ReceiptText,
  StickyNote,
  ArrowDownUp,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  apiCall,
  clearPrefill,
  navigate,
  readPrefill,
  rupiah,
  useApi,
  useAuth,
  type OrderPrefill,
} from "./lib";
import { LocationPicker } from "./location-picker";
import { RouteMap } from "./map-view";
import { TypeBadge } from "./bits";
import { calcFare } from "@/lib/fare";
import type { LocationT, OrderT, OrderType } from "@/lib/types";

const SERVICES: Array<{ type: OrderType; title: string; desc: string; icon: React.ElementType }> = [
  { type: "OJEK", title: "Ojek Penumpang", desc: "Antar kamu ke tujuan", icon: Bike },
  { type: "BARANG", title: "Antar Barang", desc: "Titip antar barang", icon: Package },
  { type: "MAKANAN", title: "Antar Makanan", desc: "Antar pesanan makanan", icon: UtensilsCrossed },
];

const STAGE_LABEL = ["Layanan", "Rute", "Konfirmasi"] as const;

export function OrderFlowView({ initialType }: { initialType?: OrderType }) {
  const { toast } = useToast();
  const { addresses, refresh } = useAuth();
  const { data: locData } = useApi<{ locations: LocationT[] }>("/api/locations");
  const locations = locData?.locations || [];

  // Prefill "Pesan lagi" / pintasan alamat (dibaca sekali saat mount,
  // diterapkan langsung sebagai nilai awal state — tanpa effect).
  const [prefill] = useState<OrderPrefill | null>(() => readPrefill());
  const startType: OrderType | undefined = initialType || prefill?.type;
  const prefillReady = !!prefill?.pickup && !!prefill?.dest && prefill.pickup.id !== prefill.dest.id;

  // Tahap: 0=Layanan, 1=Rute, 2=Konfirmasi.
  // Layanan yang sudah dipilih dari Beranda melewati tahap 0;
  // rute yang sudah terisi penuh (Pesan lagi) langsung ke konfirmasi.
  const [skipService, setSkipService] = useState(!!startType);
  const [step, setStep] = useState(startType ? (prefillReady ? 2 : 1) : 0);
  const [type, setType] = useState<OrderType | null>(startType || null);
  const [pickup, setPickup] = useState<LocationT | null>(prefill?.pickup || null);
  const [dest, setDest] = useState<LocationT | null>(prefill?.dest || null);
  const [pickupDetail, setPickupDetail] = useState(prefill?.pickupDetail || "");
  const [destDetail, setDestDetail] = useState(prefill?.destDetail || "");
  const [itemNote, setItemNote] = useState(prefill?.itemNote || "");
  const [passengerNote, setPassengerNote] = useState(prefill?.passengerNote || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bersihkan stash saat flow ditinggalkan (sudah dikonsumsi sebagai state awal).
  useEffect(() => clearPrefill, []);

  const fare = useMemo(() => {
    if (!pickup || !dest) return null;
    const total = calcFare(pickup, dest);
    return { base: 6000, distance: total - 6000, total };
  }, [pickup, dest]);

  const step2Valid = !!pickup && !!dest && pickup.id !== dest.id && ((type === "BARANG" || type === "MAKANAN") ? itemNote.trim().length > 0 : true);

  async function submit() {
    if (!type || !pickup || !dest) return;
    setBusy(true);
    setError(null);
    const { ok, data } = await apiCall<{ order: OrderT }>("/api/orders", "POST", {
      type,
      pickupLocationId: pickup.id,
      destLocationId: dest.id,
      // Koordinat pin (bisa digeser di peta); server fallback ke koordinat lokasi.
      pickupLat: pickup.lat ?? undefined,
      pickupLng: pickup.lng ?? undefined,
      destLat: dest.lat ?? undefined,
      destLng: dest.lng ?? undefined,
      pickupDetail,
      destDetail,
      itemNote,
      passengerNote,
    });
    setBusy(false);
    if (!ok) {
      setError(data.error || "Gagal membuat pesanan.");
      return;
    }
    toast({ title: "Pesanan dibuat!", description: "Sedang mencarikan driver terdekat untukmu." });
    refresh();
    navigate(`/pesanan/${data.order.code}`);
  }

  // Tahap yang tampil di stepper (Layanan bisa dilewati).
  const visibleStages = skipService ? [1, 2] : [0, 1, 2];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-6 sm:px-6">
      {/* Stepper */}
      <div className="mb-7">
        <div className="flex items-center justify-between">
          {visibleStages.map((stage, pos) => (
            <div key={stage} className="flex flex-1 items-center">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition-colors",
                  stage < step ? "bg-unp text-white" : stage === step ? "bg-unp text-white ring-4 ring-unp/20" : "bg-muted text-muted-foreground"
                )}
              >
                {stage < step ? <Check size={16} /> : pos + 1}
              </div>
              <span className={cn("ml-2 hidden text-xs font-bold sm:block", stage <= step ? "text-unp-dark" : "text-muted-foreground")}>
                {STAGE_LABEL[stage]}
              </span>
              {pos < visibleStages.length - 1 && (
                <div className={cn("mx-2 h-1 flex-1 rounded-full sm:mx-3", stage < step ? "bg-unp" : "bg-muted")} />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>
      )}

      {/* ============ TAHAP 0: LAYANAN (dilewati jika sudah dipilih) ============ */}
      {step === 0 && !skipService && (
        <div>
          <h1 className="text-xl font-extrabold sm:text-2xl">Pilih layananmu</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Tarif ketiga layanan sama, dihitung dari zona rute.</p>
          <div className="mt-6 space-y-3.5">
            {SERVICES.map((s) => (
              <button
                key={s.type}
                onClick={() => setType(s.type)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-2xl border-2 p-5 text-left transition-all",
                  type === s.type ? "border-unp bg-unp-soft shadow-md" : "border-border bg-card hover:border-unp/40"
                )}
              >
                <span
                  className={cn(
                    "flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl text-white shadow-md",
                    s.type === "MAKANAN" ? "bg-gradient-to-br from-gold to-gold-dark" : "bg-gradient-to-br from-unp to-unp-dark"
                  )}
                >
                  <s.icon size={24} />
                </span>
                <span className="flex-1">
                  <span className="block font-extrabold">{s.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{s.desc}</span>
                </span>
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                    type === s.type ? "border-unp bg-unp text-white" : "border-border"
                  )}
                >
                  {type === s.type && <Check size={14} />}
                </span>
              </button>
            ))}
          </div>
          <Button
            disabled={!type}
            onClick={() => setStep(1)}
            className="mt-7 h-13 w-full bg-unp text-base font-extrabold hover:bg-unp-dark"
          >
            Lanjut pilih rute <ArrowRight size={17} />
          </Button>
        </div>
      )}

      {/* ============ TAHAP 1: RUTE ============ */}
      {step === 1 && type && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-extrabold sm:text-2xl">Tentukan rute</h1>
            <TypeBadge type={type} />
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">Pilih titik jemput &amp; tujuan dari lokasi populer sekitar UNP.</p>

          {addresses.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {addresses.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setPickup(a.location);
                    setPickupDetail(a.detail || "");
                  }}
                  className="rounded-full border border-unp/30 bg-unp-soft px-3.5 py-1.5 text-xs font-bold text-unp-dark transition-colors hover:bg-unp/15"
                  title="Gunakan sebagai titik jemput"
                >
                  <MapPin size={12} className="mr-1 inline" /> {a.label}: {a.location.name}
                </button>
              ))}
            </div>
          )}

          <div className="relative mt-5 space-y-4">
            <LocationPicker locations={locations} value={pickup} onChange={(l) => setPickup(l)} label="Titik Jemput" placeholder="Dari mana kamu dijemput?" />
            <div className="px-1">
              <Input
                value={pickupDetail}
                onChange={(e) => setPickupDetail(e.target.value)}
                placeholder="Detail titik jemput (cth: Jl. Parkit 4, kos hijau lantai 2)"
                className="h-11 border-2"
              />
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => {
                  const p = pickup;
                  setPickup(dest);
                  setDest(p);
                  const d = pickupDetail;
                  setPickupDetail(destDetail);
                  setDestDetail(d);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-unp hover:text-unp"
                aria-label="Tukar titik jemput dan tujuan"
              >
                <ArrowDownUp size={18} />
              </button>
            </div>

            <LocationPicker locations={locations} value={dest} onChange={(l) => setDest(l)} label="Tujuan" placeholder="Mau diantar ke mana?" />
            <div className="px-1">
              <Input
                value={destDetail}
                onChange={(e) => setDestDetail(e.target.value)}
                placeholder="Detail tujuan (cth: Ruang RSG Fakultas Teknik)"
                className="h-11 border-2"
              />
            </div>
          </div>

          {(type === "BARANG" || type === "MAKANAN") && (
            <div className="mt-5 rounded-2xl border-2 border-gold/40 bg-gold-soft/40 p-4">
              <Label htmlFor="item-note" className="flex items-center gap-1.5 font-extrabold text-gold-dark">
                {type === "BARANG" ? <Package size={15} /> : <UtensilsCrossed size={15} />}
                {type === "BARANG" ? "Barang yang diantar" : "Makanan & minuman yang dipesan"}
              </Label>
              <Textarea
                id="item-note"
                required
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                placeholder={type === "BARANG" ? "cth: Laptop & charger dalam tas hitam" : "cth: Nasi rendang + es teh dari Warung Mak Endang (sudah dibayar)"}
                className="mt-2 border-2 bg-card"
                rows={2}
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">Wajib diisi agar driver tahu yang harus diantar.</p>
            </div>
          )}

          {type === "OJEK" && (
            <div className="mt-5">
              <Label htmlFor="passenger-note" className="flex items-center gap-1.5 font-semibold">
                <StickyNote size={14} /> Catatan untuk driver (opsional)
              </Label>
              <Textarea
                id="passenger-note"
                value={passengerNote}
                onChange={(e) => setPassengerNote(e.target.value)}
                placeholder="cth: Titik jemput di gerbang kos, tunggu 2 menit ya"
                className="mt-2 border-2"
                rows={2}
              />
            </div>
          )}

          {fare && (
            <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tarif dasar</span>
                <span className="font-bold">{rupiah(fare.base)}</span>
              </div>
              {fare.distance > 0 && (
                <div className="mt-1.5 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Biaya jarak (zona)</span>
                  <span className="font-bold">{rupiah(fare.distance)}</span>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="font-extrabold">Estimasi tarif</span>
                <span className="text-lg font-extrabold text-unp">{rupiah(fare.total)}</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSkipService(false); // "Kembali" dari rute = ganti layanan
                setStep(0);
              }}
              className="h-13 flex-1 border-2 font-bold"
            >
              <ArrowLeft size={16} /> Kembali
            </Button>
            <Button disabled={!step2Valid} onClick={() => setStep(2)} className="h-13 flex-[2] bg-unp text-base font-extrabold hover:bg-unp-dark">
              Lanjut konfirmasi <ArrowRight size={17} />
            </Button>
          </div>
        </div>
      )}

      {/* ============ TAHAP 2: KONFIRMASI ============ */}
      {step === 2 && type && pickup && dest && fare && (
        <div>
          <h1 className="text-xl font-extrabold sm:text-2xl">Periksa pesananmu</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Pastikan semua detail sudah benar sebelum memesan.</p>

          <div className="mt-6 space-y-4">
            {/* Pratinjau peta rute (pin jemput & tujuan) */}
            {pickup.lat != null && pickup.lng != null && dest.lat != null && dest.lng != null && (
              <RouteMap pickup={{ lat: pickup.lat, lng: pickup.lng }} dest={{ lat: dest.lat, lng: dest.lng }} />
            )}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <TypeBadge type={type} />
                <span className="text-xs font-semibold text-muted-foreground">Bayar tunai</span>
              </div>
              <div className="mt-4 flex gap-3.5">
                <div className="flex flex-col items-center self-stretch pt-1">
                  <span className="h-3 w-3 rounded-full bg-unp" />
                  <span className="my-1.5 w-0.5 flex-1 bg-gradient-to-b from-unp to-gold" />
                  <span className="h-3 w-3 rounded-full bg-gold" />
                </div>
                <div className="min-w-0 flex-1 space-y-3.5 text-sm">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Titik jemput</p>
                    <p className="font-bold">{pickup.name}</p>
                    {pickupDetail && <p className="text-muted-foreground">{pickupDetail}</p>}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tujuan</p>
                    <p className="font-bold">{dest.name}</p>
                    {destDetail && <p className="text-muted-foreground">{destDetail}</p>}
                  </div>
                </div>
              </div>
              {(type === "BARANG" || type === "MAKANAN") && itemNote && (
                <div className="mt-4 rounded-xl bg-gold-soft/50 px-3.5 py-3 text-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gold-dark">{type === "BARANG" ? "Barang" : "Makanan"}</p>
                  <p className="mt-0.5 font-semibold">{itemNote}</p>
                </div>
              )}
              {type === "OJEK" && passengerNote && (
                <div className="mt-4 rounded-xl bg-muted px-3.5 py-3 text-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Catatan</p>
                  <p className="mt-0.5 font-semibold">{passengerNote}</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-extrabold">
                <ReceiptText size={16} className="text-unp" /> Rincian tarif
              </p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tarif dasar</span>
                  <span className="font-bold">{rupiah(fare.base)}</span>
                </div>
                {fare.distance > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Biaya jarak (zona)</span>
                    <span className="font-bold">{rupiah(fare.distance)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2.5">
                  <span className="font-extrabold">Total</span>
                  <span className="text-lg font-extrabold text-unp">{rupiah(fare.total)}</span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-unp-soft px-3.5 py-3">
                <Banknote size={18} className="text-unp" />
                <p className="text-xs font-semibold text-unp-dark">
                  Pembayaran tunai langsung ke driver saat sampai tujuan.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="h-13 flex-1 border-2 font-bold">
              <ArrowLeft size={16} /> Ubah
            </Button>
            <Button onClick={submit} disabled={busy} className="h-13 flex-[2] bg-unp text-base font-extrabold hover:bg-unp-dark">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Bike size={18} />}
              Pesan Sekarang — {rupiah(fare.total)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
