"use client";

import { useRef, useState } from "react";
import {
  BadgeCheck,
  Bike,
  Camera,
  Check,
  Clock,
  Home,
  Loader2,
  LogOut,
  MapPin,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { apiCall, navigate, uploadFile, useApi, useAuth } from "./lib";
import { LocationPicker } from "./location-picker";
import { UserAvatar, VerifiedBadge } from "./bits";
import type { LocationT } from "@/lib/types";

export function ProfileView() {
  const { toast } = useToast();
  const { me, addresses, refresh, logout } = useAuth();
  const { data: locData } = useApi<{ locations: LocationT[] }>("/api/locations");
  const locations = locData?.locations || [];

  const [name, setName] = useState(me?.name || "");
  const [phone, setPhone] = useState(me?.phone || "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [addrOpen, setAddrOpen] = useState(false);
  const [addrLabel, setAddrLabel] = useState("");
  const [addrLoc, setAddrLoc] = useState<LocationT | null>(null);
  const [addrDetail, setAddrDetail] = useState("");
  const [addrBusy, setAddrBusy] = useState(false);

  async function saveProfile() {
    setSaving(true);
    const { ok, data } = await apiCall("/api/profile", "PATCH", { name, phone });
    setSaving(false);
    if (!ok) {
      toast({ title: "Gagal menyimpan", description: data.error, variant: "destructive" });
      return;
    }
    await refresh();
    toast({ title: "Profil tersimpan", description: "Informasi profilmu sudah diperbarui." });
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadFile(file);
      const { ok, data } = await apiCall("/api/profile", "PATCH", { avatarUrl: url });
      if (!ok) throw new Error(data.error);
      await refresh();
      toast({ title: "Foto profil diperbarui" });
    } catch (err) {
      toast({ title: "Gagal mengunggah", description: err instanceof Error ? err.message : "Coba lagi.", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function addAddress() {
    if (!addrLabel.trim() || !addrLoc) return;
    setAddrBusy(true);
    const { ok, data } = await apiCall("/api/profile/addresses", "POST", {
      label: addrLabel,
      locationId: addrLoc.id,
      detail: addrDetail,
    });
    setAddrBusy(false);
    if (!ok) {
      toast({ title: "Gagal menambah alamat", description: data.error, variant: "destructive" });
      return;
    }
    await refresh();
    toast({ title: "Alamat ditambahkan", description: "Kamu bisa memakainya saat memesan." });
    setAddrOpen(false);
    setAddrLabel("");
    setAddrLoc(null);
    setAddrDetail("");
  }

  async function deleteAddress(id: string) {
    const { ok, data } = await apiCall(`/api/profile/addresses/${id}`, "DELETE");
    if (!ok) {
      toast({ title: "Gagal menghapus", description: data.error, variant: "destructive" });
      return;
    }
    await refresh();
    toast({ title: "Alamat dihapus" });
  }

  const isDriver = me?.role === "DRIVER";
  const verifyBadge =
    me?.verifyStatus === "VERIFIED" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-unp-soft px-3 py-1 text-xs font-extrabold text-unp-dark">
        <ShieldCheck size={14} /> Terverifikasi
      </span>
    ) : me?.verifyStatus === "PENDING" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-xs font-extrabold text-gold-dark">
        <Clock size={14} /> Menunggu verifikasi
      </span>
    ) : me?.verifyStatus === "REJECTED" ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-extrabold text-red-600">
        <ShieldAlert size={14} /> Ditolak
      </span>
    ) : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-10 pt-6 sm:px-6">
      {/* Kartu profil */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative">
            <UserAvatar name={me?.name || "?"} url={me?.avatarUrl} size={76} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-unp text-white shadow-md transition-transform hover:scale-110"
              aria-label="Ubah foto profil"
            >
              {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onAvatarChange} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold">{me?.name}</h1>
              {verifyBadge}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{me?.email}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <BadgeCheck size={14} className="text-unp" /> NIM/NIP: <span className="font-bold text-foreground">{me?.nim}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Info dasar */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">Informasi Akun</h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="pf-name" className="font-semibold">Nama lengkap</Label>
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-12 border-2" />
          </div>
          <div>
            <Label htmlFor="pf-phone" className="font-semibold">No. HP (WhatsApp)</Label>
            <Input id="pf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5 h-12 border-2" />
          </div>
          <div>
            <Label htmlFor="pf-email" className="font-semibold">Email (tidak dapat diubah)</Label>
            <Input id="pf-email" value={me?.email || ""} disabled className="mt-1.5 h-12 border-2 bg-muted" />
          </div>
          <Button onClick={saveProfile} disabled={saving} className="h-12 w-full gap-2 bg-unp font-extrabold hover:bg-unp-dark">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan Perubahan
          </Button>
        </div>
      </div>

      {/* Info driver */}
      {isDriver && (
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
            <Bike size={15} /> Informasi Driver
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <span className="text-muted-foreground">Kendaraan</span>
              <span className="font-bold">{me?.vehicleType}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <span className="text-muted-foreground">Nomor polisi</span>
              <span className="font-bold">{me?.vehiclePlate}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <span className="text-muted-foreground">Status verifikasi KTM</span>
              {verifyBadge || <VerifiedBadge />}
            </div>
            <Button onClick={() => navigate("/mode-driver")} className="h-12 w-full gap-2 bg-unp font-extrabold hover:bg-unp-dark">
              Buka Mode Driver
            </Button>
          </div>
        </div>
      )}

      {/* Alamat tersimpan */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">Alamat Tersimpan</h2>
          <Button onClick={() => setAddrOpen(true)} size="sm" className="gap-1.5 bg-unp font-bold hover:bg-unp-dark">
            <Plus size={15} /> Tambah
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">Maksimal 5 alamat — mempercepat pemesanan berikutnya.</p>
        <div className="mt-4 space-y-2.5">
          {addresses.length === 0 && (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Belum ada alamat tersimpan. Tambahkan lokasi kos atau fakultasmu!
            </div>
          )}
          {addresses.map((a) => (
            <div key={a.id} className="flex items-center gap-3.5 rounded-xl border border-border px-4 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-unp-soft text-unp">
                {a.label.toLowerCase().includes("kos") ? <Home size={17} /> : <MapPin size={17} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">{a.label} — {a.location.name}</p>
                {a.detail && <p className="truncate text-xs text-muted-foreground">{a.detail}</p>}
              </div>
              <button
                onClick={() => deleteAddress(a.id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label={`Hapus alamat ${a.label}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Keluar */}
      <Button
        onClick={logout}
        variant="outline"
        className="h-12 w-full gap-2 border-2 border-red-200 font-bold text-red-600 hover:bg-red-50 hover:text-red-600"
      >
        <LogOut size={16} /> Keluar dari Akun
      </Button>

      {/* Dialog tambah alamat */}
      <Dialog open={addrOpen} onOpenChange={setAddrOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Alamat Tersimpan</DialogTitle>
            <DialogDescription>Contoh: lokasi kos atau gedung fakultasmu.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="addr-label" className="font-semibold">Label alamat</Label>
              <Input
                id="addr-label"
                value={addrLabel}
                onChange={(e) => setAddrLabel(e.target.value)}
                placeholder="cth: Kos, Fakultas"
                className="mt-1.5 border-2"
              />
            </div>
            <LocationPicker locations={locations} value={addrLoc} onChange={setAddrLoc} label="Lokasi" placeholder="Pilih lokasi" />
            <div>
              <Label htmlFor="addr-detail" className="font-semibold">Detail (opsional)</Label>
              <Input
                id="addr-detail"
                value={addrDetail}
                onChange={(e) => setAddrDetail(e.target.value)}
                placeholder="cth: Jl. Parkit 4, kos hijau lantai 2"
                className="mt-1.5 border-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={addAddress}
              disabled={addrBusy || !addrLabel.trim() || !addrLoc}
              className={cn("w-full gap-2 bg-unp font-extrabold hover:bg-unp-dark")}
            >
              {addrBusy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Simpan Alamat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
