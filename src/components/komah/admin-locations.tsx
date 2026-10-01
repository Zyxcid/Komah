"use client";

import { useState } from "react";
import {
  Building2,
  Check,
  Home,
  Loader2,
  MapPin,
  MapPinned,
  MousePointerClick,
  Pencil,
  Plus,
  Star,
  Store,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiCall, rupiah, useApi } from "./lib";
import { PinMap } from "./map-view";
import type { LatLng } from "./map-core";
import type { LocationT } from "@/lib/types";

const CATEGORY_META: Record<LocationT["category"], { label: string; short: string; icon: React.ElementType }> = {
  KAMPUS: { label: "Area Kampus", short: "Kampus", icon: Building2 },
  KOS: { label: "Kos & Tempat Tinggal", short: "Kos", icon: Home },
  PUBLIK: { label: "Titik Publik", short: "Publik", icon: Store },
};
const CATEGORIES = ["KAMPUS", "KOS", "PUBLIK"] as const;

// Pusat kampus UNP Air Tawar — posisi awal peta di dialog.
const KOMAH_CENTER: LatLng = { lat: -0.901, lng: 100.35 };

interface FormState {
  name: string;
  category: LocationT["category"];
  fare: string;
  isPopular: boolean;
  coords: LatLng | null;
}

const EMPTY_FORM: FormState = { name: "", category: "KAMPUS", fare: "6000", isPopular: false, coords: null };

export function AdminLocationsView() {
  const { toast } = useToast();
  const { data, refetch, loading } = useApi<{ locations: LocationT[]; baseFare: number }>("/api/admin/locations");

  const locations = data?.locations || [];
  const baseFare = data?.baseFare ?? 6000;

  // ---- Tarif dasar (null = belum disentuh, ikut nilai server) ----
  const [fareInput, setFareInput] = useState<string | null>(null);
  const [savingFare, setSavingFare] = useState(false);
  const fareValue = fareInput ?? String(baseFare);
  const fareDirty = fareInput !== null && fareInput.trim() !== "" && parseInt(fareInput, 10) !== baseFare;

  // ---- Dialog tambah/sunting lokasi ----
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LocationT | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);

  // ---- Konfirmasi hapus ----
  const [deleting, setDeleting] = useState<LocationT | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const counts = {
    KAMPUS: locations.filter((l) => l.category === "KAMPUS").length,
    KOS: locations.filter((l) => l.category === "KOS").length,
    PUBLIK: locations.filter((l) => l.category === "PUBLIK").length,
  };

  async function saveBaseFare() {
    const n = parseInt(fareValue, 10);
    if (!Number.isFinite(n) || n < 1000 || n > 1_000_000) {
      toast({ title: "Nilai tidak valid", description: "Isi tarif antara Rp1.000 – Rp1.000.000.", variant: "destructive" });
      return;
    }
    setSavingFare(true);
    const { ok, data: res } = await apiCall("/api/admin/settings", "PATCH", { baseFare: n });
    setSavingFare(false);
    if (!ok) {
      toast({ title: "Gagal menyimpan", description: res.error, variant: "destructive" });
      return;
    }
    setFareInput(null);
    refetch();
    toast({ title: "Tarif dasar tersimpan", description: res.message });
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, fare: String(baseFare) });
    setFormOpen(true);
  }

  function openEdit(loc: LocationT) {
    setEditing(loc);
    setForm({
      name: loc.name,
      category: loc.category,
      fare: String(loc.fare),
      isPopular: loc.isPopular,
      coords: loc.lat != null && loc.lng != null ? { lat: loc.lat, lng: loc.lng } : null,
    });
    setFormOpen(true);
  }

  async function submitForm() {
    const fareForCategory = form.category === "KAMPUS" ? baseFare : parseInt(form.fare, 10);
    if (!form.name.trim()) {
      toast({ title: "Nama lokasi wajib diisi", variant: "destructive" });
      return;
    }
    if (form.category !== "KAMPUS" && (!Number.isFinite(fareForCategory) || fareForCategory < 0 || fareForCategory > 1_000_000)) {
      toast({ title: "Tarif tidak valid", description: "Isi tarif antara Rp0 – Rp1.000.000.", variant: "destructive" });
      return;
    }
    if (!form.coords) {
      toast({ title: "Tandai titik di peta dulu", description: "Klik peta pada dialog untuk menentukan koordinat.", variant: "destructive" });
      return;
    }
    setFormBusy(true);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      fare: fareForCategory,
      isPopular: form.isPopular,
      lat: form.coords.lat,
      lng: form.coords.lng,
    };
    const { ok, data: res } = editing
      ? await apiCall<{ location: LocationT }>(`/api/admin/locations/${editing.id}`, "PATCH", payload)
      : await apiCall<{ location: LocationT }>("/api/admin/locations", "POST", payload);
    setFormBusy(false);
    if (!ok) {
      toast({ title: "Gagal menyimpan", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Lokasi diperbarui" : "Lokasi ditambahkan", description: res.message });
    setFormOpen(false);
    refetch();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    const { ok, data: res } = await apiCall(`/api/admin/locations/${deleting.id}`, "DELETE");
    setDeleteBusy(false);
    if (!ok) {
      toast({ title: "Tidak dapat dihapus", description: res.error, variant: "destructive" });
      setDeleting(null);
      return;
    }
    toast({ title: "Lokasi dihapus", description: res.message });
    setDeleting(null);
    refetch();
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-6 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-unp to-unp-dark text-white shadow-md">
          <MapPinned size={20} />
        </span>
        <div>
          <h1 className="text-xl font-extrabold sm:text-2xl">Kelola Lokasi &amp; Tarif</h1>
          <p className="text-sm text-muted-foreground">Tambah titik layanan baru &amp; sesuaikan harga zone.</p>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="mt-5 grid grid-cols-3 gap-3.5">
        {(Object.keys(CATEGORY_META) as Array<keyof typeof CATEGORY_META>).map((cat) => {
          const Meta = CATEGORY_META[cat];
          return (
            <div key={cat} className="rounded-2xl border border-border bg-card p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Meta.icon size={13} /> {Meta.label}
              </p>
              <p className="mt-1.5 text-2xl font-extrabold text-unp">{counts[cat]}</p>
            </div>
          );
        })}
      </div>

      {/* Tarif dasar dalam kampus */}
      <div className="mt-5 rounded-2xl border-2 border-gold/40 bg-gold-soft/25 p-5">
        <p className="text-sm font-extrabold text-gold-dark">Tarif dasar dalam kampus</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Tarif untuk perjalanan antar titik Area Kampus. Perjalanan ke luar kampus memakai tarif masing-masing lokasi.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">Rp</span>
            <Input
              value={fareValue}
              onChange={(e) => setFareInput(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              className="h-11 w-40 border-2 pl-9 font-bold"
              aria-label="Tarif dasar dalam kampus"
            />
          </div>
          <Button
            onClick={saveBaseFare}
            disabled={!fareDirty || savingFare}
            className="h-11 gap-2 bg-unp font-extrabold hover:bg-unp-dark"
          >
            {savingFare ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Simpan Tarif
          </Button>
          {fareDirty && (
            <button onClick={() => setFareInput(null)} className="text-xs font-bold text-muted-foreground underline-offset-2 hover:underline">
              batalkan perubahan
            </button>
          )}
        </div>
      </div>

      {/* Daftar lokasi */}
      <div className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">Titik Layanan ({locations.length})</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Lokasi ini muncul di peta &amp; daftar pilihan saat mahasiswa memesan.</p>
          </div>
          <Button onClick={openAdd} className="gap-1.5 bg-unp font-bold hover:bg-unp-dark">
            <Plus size={15} /> Tambah Lokasi
          </Button>
        </div>

        <div className="mt-4">
          {loading && <div className="h-32 animate-pulse rounded-2xl bg-muted" />}
          {!loading && locations.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Belum ada lokasi — tambahkan titik pertama.
            </p>
          )}
          <ScrollArea className={locations.length > 6 ? "max-h-[26rem]" : ""}>
            <div className="space-y-2">
              {locations.map((loc) => {
                const Meta = CATEGORY_META[loc.category];
                return (
                  <div key={loc.id} className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-unp-soft text-unp">
                      <Meta.icon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-bold">
                        <span className="truncate">{loc.name}</span>
                        {loc.isPopular && (
                          <span className="shrink-0 rounded-full bg-gold-soft px-1.5 py-0.5 text-[10px] font-bold text-gold-dark">Populer</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {Meta.label} • {loc.category === "KAMPUS" ? `tarif dasar ${rupiah(baseFare)}` : `${rupiah(loc.fare)} dari kampus`}
                        {loc.lat == null || loc.lng == null ? " • tanpa koordinat" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => openEdit(loc)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-unp-soft hover:text-unp"
                      aria-label={`Sunting ${loc.name}`}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleting(loc)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label={`Hapus ${loc.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Dialog tambah / sunting lokasi */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Sunting: ${editing.name}` : "Tambah Lokasi Baru"}</DialogTitle>
            <DialogDescription>
              Tandai titik di peta, beri nama, lalu atur tarifnya. Lokasi langsung dipakai saat mahasiswa memesan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Peta penanda koordinat */}
            <div>
              <Label className="text-sm font-semibold">Titik di peta</Label>
              <div className="relative mt-1.5 h-44 overflow-hidden rounded-2xl border-2 border-border">
                <PinMap
                  center={form.coords || KOMAH_CENTER}
                  value={form.coords}
                  onChange={(p) => setForm((s) => ({ ...s, coords: p }))}
                />
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <MousePointerClick size={13} className="shrink-0 text-unp" />
                {form.coords
                  ? `Koordinat: ${form.coords.lat.toFixed(5)}, ${form.coords.lng.toFixed(5)}`
                  : "Klik peta untuk menandai titik lokasi."}
              </p>
            </div>

            <div>
              <Label htmlFor="loc-name" className="text-sm font-semibold">Nama lokasi</Label>
              <Input
                id="loc-name"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="cth: Kantin FMIPA, Kos Jl. Manggis"
                className="mt-1.5 border-2"
              />
            </div>

            <div>
              <Label className="text-sm font-semibold">Kategori</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => {
                  const Meta = CATEGORY_META[cat];
                  const active = form.category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm((s) => ({ ...s, category: cat }))}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-[11px] font-bold transition-colors",
                        active ? "border-unp bg-unp-soft text-unp-dark" : "border-border bg-card text-muted-foreground hover:border-unp/40"
                      )}
                    >
                      <Meta.icon size={18} className={active ? "text-unp" : ""} />
                      {Meta.short}
                    </button>
                  );
                })}
              </div>
            </div>

            {form.category === "KAMPUS" ? (
              <p className="rounded-xl bg-muted px-4 py-3 text-xs font-semibold text-muted-foreground">
                Antar titik Area Kampus memakai tarif dasar {rupiah(baseFare)} — atur di kartu &ldquo;Tarif dasar dalam kampus&rdquo;.
              </p>
            ) : (
              <div>
                <Label htmlFor="loc-fare" className="text-sm font-semibold">Tarif dari/ke kampus (Rp)</Label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">Rp</span>
                  <Input
                    id="loc-fare"
                    value={form.fare}
                    onChange={(e) => setForm((s) => ({ ...s, fare: e.target.value.replace(/[^0-9]/g, "") }))}
                    inputMode="numeric"
                    className="h-11 border-2 pl-9 font-bold"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Rute luar↔luar kampus otomatis memakai tarif tertinggi + Rp1.000.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border-2 border-border px-4 py-3">
              <div>
                <p className="text-sm font-bold">Tandai Populer</p>
                <p className="text-xs text-muted-foreground">Beri badge &ldquo;Populer&rdquo; di daftar pilihan.</p>
              </div>
              <Switch checked={form.isPopular} onCheckedChange={(v) => setForm((s) => ({ ...s, isPopular: v }))} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} className="border-2 font-bold">
              Batal
            </Button>
            <Button onClick={submitForm} disabled={formBusy} className="gap-2 bg-unp font-extrabold hover:bg-unp-dark">
              {formBusy ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
              {editing ? "Simpan Perubahan" : "Tambah Lokasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus lokasi &ldquo;{deleting?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Lokasi akan hilang dari peta &amp; daftar pilihan mahasiswa. Lokasi yang tercatat di riwayat pesanan tidak dapat dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault(); // jangan tutup otomatis — tunggu hasil API
                confirmDelete();
              }}
              className="gap-1.5 bg-red-600 font-bold hover:bg-red-700"
            >
              {deleteBusy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-4 flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <TriangleAlert size={13} className="mt-0.5 shrink-0 text-gold-dark" />
        Perubahan tarif berlaku untuk pesanan baru — pesanan lama tetap memakai tarif saat dipesan.
      </p>
    </div>
  );
}
