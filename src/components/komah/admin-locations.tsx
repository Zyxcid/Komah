"use client";

// Kelola lokasi (admin) — tambah titik baru dengan nama & tarif zona sendiri,
// ubah tarif/nama, hapus titik yang tidak terpakai. Tarif dasar dalam kampus
// juga diatur dari sini.

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
  Wallet,
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
import { apiCall, navigate, rupiah, useApi } from "./lib";
import { EmptyState } from "./bits";
import type { LocationT } from "@/lib/types";

const CATEGORY_META: Record<LocationT["category"], { label: string; icon: React.ElementType }> = {
  KAMPUS: { label: "Area Kampus", icon: Building2 },
  KOS: { label: "Kos & Tempat Tinggal", icon: Home },
  PUBLIK: { label: "Titik Publik", icon: Store },
};
const CATEGORIES = Object.keys(CATEGORY_META) as Array<LocationT["category"]>;

export function AdminLocationsView() {
  const { toast } = useToast();
  const { data, refetch, loading } = useApi<{ locations: LocationT[]; baseFare: number }>("/api/admin/locations", {
    interval: 30000,
  });
  const locations = data?.locations || [];
  const baseFare = data?.baseFare ?? 6000;

  const [busy, setBusy] = useState<string | null>(null);

  // Dialog tambah/ubah lokasi
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LocationT | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<LocationT["category"]>("KAMPUS");
  const [fare, setFare] = useState("6000");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [isPopular, setIsPopular] = useState(false);
  const [formBusy, setFormBusy] = useState(false);

  // Tarif dasar
  const [baseFareDraft, setBaseFareDraft] = useState<string | null>(null);
  const [fareBusy, setFareBusy] = useState(false);

  const grouped = useMemo(() => {
    return CATEGORIES.map((cat) => ({ cat, items: locations.filter((l) => l.category === cat) })).filter(
      (g) => g.items.length > 0
    );
  }, [locations]);

  function openAdd() {
    setEditing(null);
    setName("");
    setCategory("KAMPUS");
    setFare("6000");
    setLat("");
    setLng("");
    setIsPopular(false);
    setFormOpen(true);
  }

  function openEdit(l: LocationT) {
    setEditing(l);
    setName(l.name);
    setCategory(l.category);
    setFare(String(l.fare));
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
      fare: Number(fare),
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

  async function saveBaseFare() {
    const v = Number(baseFareDraft);
    if (!Number.isFinite(v) || v < 1000) {
      toast({ title: "Tarif tidak valid", description: "Minimal Rp1.000.", variant: "destructive" });
      return;
    }
    setFareBusy(true);
    const { ok, data: res } = await apiCall("/api/admin/settings", "PUT", { baseFare: v });
    setFareBusy(false);
    if (!ok) {
      toast({ title: "Gagal menyimpan tarif", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Tarif dasar diperbarui", description: `Kini ${rupiah(v)} untuk rute dalam kampus.` });
    setBaseFareDraft(null);
    refetch();
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-10 pt-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-md text-sm text-muted-foreground">
          Titik yang bisa dipilih penumpang. Atur nama, zona, dan tarifnya.
        </p>
        <Button onClick={openAdd} className="gap-2 bg-unp font-extrabold hover:bg-unp-dark">
          <Plus size={16} /> Tambah Lokasi
        </Button>
      </div>

      {/* Tarif dasar dalam kampus */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-unp/25 bg-unp-soft/40 p-5">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-unp to-unp-dark text-white shadow-md">
            <Wallet size={22} />
          </span>
          <div>
            <p className="text-sm font-extrabold">Tarif dasar dalam kampus</p>
            <p className="text-xs text-muted-foreground">Berlaku untuk rute antar titik Area Kampus.</p>
          </div>
        </div>
        {baseFareDraft === null ? (
          <button
            onClick={() => setBaseFareDraft(String(baseFare))}
            className="flex items-center gap-2 rounded-2xl border-2 border-unp/30 bg-card px-4 py-2.5 text-lg font-extrabold text-unp transition-colors hover:border-unp"
          >
            {rupiah(baseFare)} <Pencil size={14} className="text-muted-foreground" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={baseFareDraft}
              onChange={(e) => setBaseFareDraft(e.target.value)}
              className="h-11 w-32 border-2 text-right text-base font-bold"
              autoFocus
            />
            <Button onClick={saveBaseFare} disabled={fareBusy} className="h-11 gap-1.5 bg-unp font-extrabold hover:bg-unp-dark">
              {fareBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Simpan
            </Button>
            <Button variant="outline" onClick={() => setBaseFareDraft(null)} className="h-11 border-2 font-bold">
              Batal
            </Button>
          </div>
        )}
      </div>

      {/* Daftar lokasi per kategori */}
      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      ) : locations.length === 0 ? (
        <EmptyState
          icon={<MapPin size={26} />}
          title="Belum ada lokasi"
          desc="Tambahkan titik kampus, kos, dan tempat publik agar penumpang bisa memesan."
          action={
            <Button onClick={openAdd} className="gap-2 bg-unp font-bold hover:bg-unp-dark">
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
                        {cat === "KAMPUS" ? "Tarif dasar" : `${rupiah(l.fare)} dari kampus`}
                        {l.lat != null && l.lng != null ? " • ada koordinat peta" : " • tanpa koordinat"}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Lokasi" : "Tambah Lokasi Baru"}</DialogTitle>
            <DialogDescription>
              Nama, zona, dan tarif ini yang dilihat penumpang saat memesan.
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
              {category !== "KAMPUS" && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Tarif di bawah dipakai untuk rute kampus ↔ lokasi ini.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="loc-fare" className="font-semibold">
                  Tarif {category === "KAMPUS" ? "(tidak dipakai)" : "dari kampus"}
                </Label>
                <Input
                  id="loc-fare"
                  type="number"
                  value={fare}
                  onChange={(e) => setFare(e.target.value)}
                  className="mt-1.5 border-2"
                  disabled={category === "KAMPUS"}
                />
              </div>
              <div className="flex items-end justify-end pb-1.5">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
                  <Switch checked={isPopular} onCheckedChange={setIsPopular} className="data-[state=checked]:bg-gold" />
                  Tandai populer
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="loc-lat" className="font-semibold">Latitude (opsional)</Label>
                <Input
                  id="loc-lat"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="-0.9042"
                  className="mt-1.5 border-2"
                />
              </div>
              <div>
                <Label htmlFor="loc-lng" className="font-semibold">Longitude (opsional)</Label>
                <Input
                  id="loc-lng"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="100.3462"
                  className="mt-1.5 border-2"
                />
              </div>
            </div>
            <p className="rounded-xl bg-muted px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              <MapPin size={12} className="mr-1 inline text-unp" />
              Koordinat membuat titik muncul di peta penumpang, boleh dikosongkan bila tidak tahu pasti.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={submitForm} disabled={formBusy} className="w-full gap-2 bg-unp font-extrabold hover:bg-unp-dark">
              {formBusy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {editing ? "Simpan Perubahan" : "Tambah Lokasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
