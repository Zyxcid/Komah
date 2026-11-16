"use client";

// Kelola lokasi (admin) — tambah titik baru dengan nama & koordinat, ubah
// nama/koordinat, hapus titik yang tidak terpakai. Tarif tidak diatur di
// sini lagi: harga dihitung otomatis dari jarak tempuh sesuai daftar harga
// resmi KOMAH (src/lib/fare.ts) — ringkasannya diperlihatkan sebagai info.

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  Home,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Store,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiCall, useApi } from "./lib";
import { EmptyState } from "./bits";
import { PinMap } from "./map-view";
import type { LocationT } from "@/lib/types";

const CATEGORY_META: Record<LocationT["category"], { label: string; icon: React.ElementType }> = {
  KAMPUS: { label: "Area Kampus", icon: Building2 },
  KOS: { label: "Kos & Tempat Tinggal", icon: Home },
  PUBLIK: { label: "Titik Publik", icon: Store },
};
const CATEGORIES = Object.keys(CATEGORY_META) as Array<LocationT["category"]>;

// Pusat kampus UNP (posisi awal peta admin).
const UNP_CENTER = { lat: -0.9009, lng: 100.3505 };

export function AdminLocationsView() {
  const { toast } = useToast();
  const { data, refetch, loading, error } = useApi<{ locations: LocationT[] }>("/api/admin/locations", {
    interval: 30000,
  });
  const locations = data?.locations || [];

  const [busy, setBusy] = useState<string | null>(null);

  // Dialog tambah/ubah lokasi
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LocationT | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<LocationT["category"]>("KAMPUS");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [isPopular, setIsPopular] = useState(false);
  const [formBusy, setFormBusy] = useState(false);

  const grouped = useMemo(() => {
    return CATEGORIES.map((cat) => ({ cat, items: locations.filter((l) => l.category === cat) })).filter(
      (g) => g.items.length > 0
    );
  }, [locations]);

  // Titik peta form: null bila koordinat belum ditandai.
  const mapPoint = lat.trim() !== "" && lng.trim() !== "" ? { lat: Number(lat), lng: Number(lng) } : null;
  const mapCenter = mapPoint || UNP_CENTER;

  function openAdd() {
    setEditing(null);
    setName("");
    setCategory("KAMPUS");
    setLat("");
    setLng("");
    setIsPopular(false);
    setFormOpen(true);
  }

  function openEdit(l: LocationT) {
    setEditing(l);
    setName(l.name);
    setCategory(l.category);
    setLat(l.lat != null ? String(l.lat) : "");
    setLng(l.lng != null ? String(l.lng) : "");
    setIsPopular(l.isPopular);
    setFormOpen(true);
  }

  async function submitForm() {
    if (!name.trim()) {
      toast({ title: "Nama lokasi wajib diisi", variant: "destructive" });
      return;
    }
    setFormBusy(true);
    const payload = {
      name: name.trim(),
      category,
      lat: lat.trim() === "" ? null : Number(lat),
      lng: lng.trim() === "" ? null : Number(lng),
      isPopular,
    };
    const { ok, data: res } = editing
      ? await apiCall(`/api/admin/locations/${editing.id}`, "PATCH", payload)
      : await apiCall("/api/admin/locations", "POST", payload);
    setFormBusy(false);
    if (!ok) {
      toast({ title: "Gagal menyimpan", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Lokasi diperbarui" : "Lokasi ditambahkan", description: res.message });
    setFormOpen(false);
    refetch();
  }

  async function removeLoc(l: LocationT) {
    setBusy(l.id);
    const { ok, data: res } = await apiCall(`/api/admin/locations/${l.id}`, "DELETE");
    setBusy(null);
    if (!ok) {
      toast({ title: "Gagal menghapus", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Lokasi dihapus", description: res.message });
    refetch();
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-10 pt-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-md text-sm text-muted-foreground">
          Titik yang bisa dipilih penumpang. Atur nama, zona, dan koordinat peta —
          tarif dihitung otomatis dari jarak rute, jadi pastikan koordinat terisi agar jarak terukur.
        </p>
        <Button onClick={openAdd} className="gap-2 bg-gold font-extrabold hover:bg-gold-dark">
          <Plus size={16} /> Tambah Lokasi
        </Button>
      </div>

      {/* Daftar lokasi per kategori */}
      {error ? (
        <EmptyState
          icon={<AlertTriangle size={26} />}
          title="Gagal memuat lokasi"
          desc={`${error} Coba muat ulang; bila berlanjut, jalankan npm run db:push dan periksa log server.`}
        />
      ) : loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      ) : locations.length === 0 ? (
        <EmptyState
          icon={<MapPin size={26} />}
          title="Belum ada lokasi"
          desc="Tambahkan titik kampus, kos, dan tempat publik agar penumpang bisa memesan."
          action={
            <Button onClick={openAdd} className="gap-2 bg-gold font-bold hover:bg-gold-dark">
              <Plus size={15} /> Tambah Lokasi
            </Button>
          }
        />
      ) : (
        grouped.map(({ cat, items }) => {
          const Icon = CATEGORY_META[cat].icon;
          return (
            <section key={cat}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                <Icon size={14} className="text-unp" /> {CATEGORY_META[cat].label}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{items.length}</span>
              </h2>
              <div className="space-y-2.5">
                {items.map((l) => (
                  <div
                    key={l.id}
                    className={cn(
                      "flex items-center gap-3.5 rounded-2xl border bg-card p-4 shadow-sm",
                      l.isPopular ? "border-gold/40" : "border-border"
                    )}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-unp-soft text-unp">
                      <Icon size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-extrabold">
                        {l.name}
                        {l.isPopular && (
                          <span className="rounded-full bg-gold-soft px-1.5 py-0.5 text-[10px] font-bold text-gold-dark">Populer</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {l.lat != null && l.lng != null ? "Ada koordinat peta (jarak terukur)" : "Tanpa koordinat — tarif minimum"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => openEdit(l)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-unp-soft hover:text-unp"
                        aria-label={`Ubah ${l.name}`}
                      >
                        <Pencil size={15} />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            disabled={busy === l.id}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            aria-label={`Hapus ${l.name}`}
                          >
                            {busy === l.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle size={17} className="text-gold-dark" /> Hapus lokasi ini?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {l.name} akan dihapus dari daftar pilihan penumpang. Lokasi yang sudah dipakai
                              riwayat pesanan tidak bisa dihapus.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeLoc(l)} className="bg-red-600 hover:bg-red-700">
                              Ya, Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}

      {/* Dialog tambah/ubah lokasi */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Lokasi" : "Tambah Lokasi Baru"}</DialogTitle>
            <DialogDescription>
              Nama dan koordinat ini yang dilihat penumpang saat memesan. Tarif dihitung
              otomatis dari jarak rute.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="loc-name" className="font-semibold">Nama lokasi</Label>
              <Input
                id="loc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cth: Terminal Lubuk Begalung"
                className="mt-1.5 border-2"
                autoFocus
              />
            </div>
            <div>
              <Label className="font-semibold">Zona</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => {
                  const Icon = CATEGORY_META[c].icon;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      aria-pressed={category === c}
                      className={cn(
                        "flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-[11px] font-bold transition-colors",
                        category === c
                          ? "border-unp bg-unp-soft text-unp-dark"
                          : "border-border bg-card text-muted-foreground hover:border-unp/40"
                      )}
                    >
                      <Icon size={15} />
                      {CATEGORY_META[c].label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-end">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
                <Switch checked={isPopular} onCheckedChange={setIsPopular} className="data-[state=checked]:bg-gold" />
                Tandai populer
              </label>
            </div>
            <div>
              <Label className="font-semibold">Titik di peta</Label>
              <div className="mt-1.5">
                <PinMap
                  center={mapCenter}
                  value={mapPoint}
                  onChange={(p) => {
                    setLat(p.lat.toFixed(6));
                    setLng(p.lng.toFixed(6));
                  }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[11px] leading-snug text-muted-foreground">
                <span>
                  {mapPoint
                    ? `Koordinat: ${mapPoint.lat.toFixed(5)}, ${mapPoint.lng.toFixed(5)}`
                    : "Ketuk peta untuk menandai titik (opsional)."}
                </span>
                {mapPoint && (
                  <button
                    type="button"
                    onClick={() => {
                      setLat("");
                      setLng("");
                    }}
                    className="shrink-0 font-bold text-red-600 hover:underline"
                  >
                    Hapus koordinat
                  </button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitForm} disabled={formBusy} className="w-full gap-2 bg-gold font-extrabold hover:bg-gold-dark">
              {formBusy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {editing ? "Simpan Perubahan" : "Tambah Lokasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
