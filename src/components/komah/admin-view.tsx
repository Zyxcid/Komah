"use client";

import { useState } from "react";
import { BadgeCheck, Check, Eye, Loader2, ShieldCheck, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiCall, dateId, useApi } from "./lib";
import { EmptyState, UserAvatar } from "./bits";

interface PendingDriver {
  id: string;
  name: string;
  email: string;
  phone: string;
  nim: string | null;
  vehiclePlate: string | null;
  vehicleType: string | null;
  ktmUrl: string | null;
  createdAt: string;
}

export function AdminView() {
  const { toast } = useToast();
  const { data, refetch, loading } = useApi<{ pending: PendingDriver[]; verifiedCount: number }>("/api/admin/verifications", { interval: 10000 });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PendingDriver | null>(null);

  async function decide(driverId: string, decision: "approve" | "reject") {
    setBusyId(driverId + decision);
    const { ok, data: res } = await apiCall("/api/admin/verifications", "POST", { driverId, decision });
    setBusyId(null);
    if (!ok) {
      toast({ title: "Gagal", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: decision === "approve" ? "Driver disetujui" : "Pendaftaran ditolak", description: res.message });
    refetch();
  }

  const pending = data?.pending || [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-6 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-unp to-unp-dark text-white shadow-md">
          <ShieldCheck size={20} />
        </span>
        <div>
          <h1 className="text-xl font-extrabold sm:text-2xl">Panel Verifikasi Driver</h1>
          <p className="text-sm text-muted-foreground">Periksa KTM sebelum menyetujui driver baru.</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3.5">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <UserCheck size={13} /> Menunggu diverifikasi
          </p>
          <p className="mt-1.5 text-2xl font-extrabold text-gold-dark">{pending.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <BadgeCheck size={13} /> Driver aktif terverifikasi
          </p>
          <p className="mt-1.5 text-2xl font-extrabold text-unp">{data?.verifiedCount ?? 0}</p>
        </div>
      </div>

      <div className="mt-7 space-y-4">
        {loading && <div className="h-32 animate-pulse rounded-2xl bg-muted" />}

        {!loading && pending.length === 0 && (
          <EmptyState
            icon={<Check size={26} />}
            title="Semua verifikasi sudah diproses"
            desc="Tidak ada pendaftaran driver baru yang menunggu. Pendaftaran baru akan muncul di sini secara otomatis."
          />
        )}

        {pending.map((d) => (
          <div key={d.id} className="rounded-3xl border-2 border-gold/40 bg-gold-soft/25 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <UserAvatar name={d.name} size={52} />
                <div>
                  <p className="font-extrabold">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    NIM {d.nim} • {d.vehicleType} • {d.vehiclePlate}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {d.email} • {d.phone}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-gold px-2.5 py-1 text-[11px] font-extrabold text-unp-deep">
                Daftar {dateId(d.createdAt)}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <Button
                onClick={() => setPreview(d)}
                variant="outline"
                size="sm"
                className="gap-1.5 border-2 font-bold"
              >
                <Eye size={14} /> Lihat KTM
              </Button>
              <Button
                onClick={() => decide(d.id, "approve")}
                disabled={busyId === d.id + "approve"}
                size="sm"
                className="gap-1.5 bg-unp font-extrabold hover:bg-unp-dark"
              >
                {busyId === d.id + "approve" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Setujui
              </Button>
              <Button
                onClick={() => decide(d.id, "reject")}
                disabled={busyId === d.id + "reject"}
                size="sm"
                variant="outline"
                className="gap-1.5 border-2 border-red-200 font-bold text-red-600 hover:bg-red-50 hover:text-red-600"
              >
                {busyId === d.id + "reject" ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                Tolak
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Dialog pratinjau KTM */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Kartu Tanda Mahasiswa: {preview?.name}</DialogTitle>
            <DialogDescription>Periksa kesesuaian nama, NIM, dan foto dengan data pendaftaran.</DialogDescription>
          </DialogHeader>
          {preview?.ktmUrl ? (
            <img
              src={preview.ktmUrl}
              alt={`KTM ${preview.name}`}
              className="w-full rounded-2xl border border-border object-contain"
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
              KTM tidak tersedia.
            </div>
          )}
          <div className="rounded-xl bg-muted px-4 py-3 text-sm">
            <p className="flex justify-between">
              <span className="text-muted-foreground">Nama pendaftar</span>
              <span className="font-bold">{preview?.name}</span>
            </p>
            <p className="mt-1.5 flex justify-between">
              <span className="text-muted-foreground">NIM</span>
              <span className="font-bold">{preview?.nim}</span>
            </p>
            <p className="mt-1.5 flex justify-between">
              <span className="text-muted-foreground">Kendaraan</span>
              <span className="font-bold">{preview?.vehicleType} • {preview?.vehiclePlate}</span>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
