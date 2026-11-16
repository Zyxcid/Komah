"use client";

// Panel Laporan (admin) — tindak lanjut laporan pelanggaran dari pengguna:
// penumpang → driver atau driver → penumpang. Dari sini admin bisa langsung
// memblokir driver yang dilaporkan (alasan wajib, laporan otomatis ditutup)
// atau menandai laporan selesai dengan catatan.

import { useMemo, useState } from "react";
import { Ban, Check, Flag, Loader2, ShieldCheck } from "lucide-react";
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
import { apiCall, dateId, timeId, useApi } from "./lib";
import { EmptyState, TypeIcon } from "./bits";
import type { ReportT } from "@/lib/types";

type Filter = "terbuka" | "selesai";

export function AdminReportsView() {
  const { toast } = useToast();
  const { data, refetch, loading } = useApi<{ reports: ReportT[]; openCount: number }>("/api/admin/reports", {
    interval: 15000,
  });
  const reports = data?.reports || [];

  const [filter, setFilter] = useState<Filter>("terbuka");

  // Dialog blokir driver dari laporan (alasan wajib).
  const [banTarget, setBanTarget] = useState<ReportT | null>(null);
  const [reason, setReason] = useState("");
  const [banBusy, setBanBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(
    () => reports.filter((r) => (filter === "terbuka" ? r.status === "OPEN" : r.status === "RESOLVED")),
    [reports, filter]
  );

  async function submitBan() {
    if (!banTarget) return;
    setBanBusy(true);
    const { ok, data: res } = await apiCall(`/api/admin/reports/${banTarget.id}`, "PATCH", {
      action: "ban_target",
      reason: reason.trim(),
    });
    setBanBusy(false);
    if (!ok) {
      toast({ title: "Gagal memblokir", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Driver diblokir", description: res.message });
    setBanTarget(null);
    setReason("");
    refetch();
  }

  async function resolve(r: ReportT) {
    setBusyId(r.id);
    const { ok, data: res } = await apiCall(`/api/admin/reports/${r.id}`, "PATCH", { action: "resolve" });
    setBusyId(null);
    if (!ok) {
      toast({ title: "Gagal menutup laporan", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Laporan selesai", description: res.message });
    refetch();
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-10 pt-6 sm:px-6">
      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "terbuka", label: "Terbuka" },
            { key: "selesai", label: "Selesai" },
          ] as Array<{ key: Filter; label: string }>
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              "rounded-full border-2 px-3.5 py-1.5 text-xs font-bold transition-colors",
              filter === f.key
                ? "border-unp bg-unp-soft text-unp-dark"
                : "border-border bg-card text-muted-foreground hover:border-unp/40"
            )}
          >
            {f.label}
            {f.key === "terbuka" && (data?.openCount ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                {data?.openCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Flag size={26} />}
          title={filter === "terbuka" ? "Tidak ada laporan terbuka" : "Belum ada laporan selesai"}
          desc={filter === "terbuka" ? "Laporan pelanggaran dari pengguna akan muncul di sini." : "Laporan yang sudah ditindak tersimpan di sini."}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((r) => (
            <div
              key={r.id}
              className={cn(
                "rounded-2xl border bg-card p-4 shadow-sm",
                r.status === "OPEN" ? "border-red-200" : "border-border"
              )}
            >
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <Flag size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold">
                      {r.reporter.name} <span className="text-muted-foreground">melaporkan</span> {r.target.name}
                    </p>
                    {r.target.role === "DRIVER" ? (
                      <span className="rounded-full bg-unp-soft px-2 py-0.5 text-[10px] font-extrabold text-unp-dark">DRIVER</span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-extrabold text-muted-foreground">PENUMPANG</span>
                    )}
                    {r.target.banned && (
                      <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-700">
                        <Ban size={10} /> DIBLOKIR
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs font-bold text-red-700">{r.reason}</p>
                  {r.note && <p className="mt-1 rounded-xl bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">“{r.note}”</p>}
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                    <TypeIcon type={r.order.type} size={12} />
                    <button onClick={() => (window.location.hash = `#/pesanan/${r.order.code}`)} className="font-bold text-unp underline">
                      {r.order.code}
                    </button>
                    • {dateId(r.createdAt)} {timeId(r.createdAt)}
                  </p>

                  {r.status === "RESOLVED" && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      <ShieldCheck size={13} className="mt-0.5 shrink-0" />
                      <span>
                        <span className="font-extrabold">Selesai.</span>{" "}
                        {r.resolution || "Ditindak admin."}
                        {r.resolvedAt && ` (${dateId(r.resolvedAt)})`}
                      </span>
                    </p>
                  )}

                  {r.status === "OPEN" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.target.role === "DRIVER" && !r.target.banned && (
                        <Button
                          onClick={() => {
                            setBanTarget(r);
                            setReason("");
                          }}
                          className="h-9 gap-1.5 rounded-xl bg-red-600 px-3.5 text-xs font-extrabold hover:bg-red-700"
                        >
                          <Ban size={13} /> Blokir Driver
                        </Button>
                      )}
                      <Button
                        onClick={() => resolve(r)}
                        disabled={busyId === r.id}
                        variant="outline"
                        className="h-9 gap-1.5 rounded-xl border-2 px-3.5 text-xs font-extrabold"
                      >
                        {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Tandai Selesai
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog blokir dari laporan */}
      <Dialog open={!!banTarget} onOpenChange={(o) => !o && setBanTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban size={17} className="text-red-600" /> Blokir {banTarget?.target.name}?
            </DialogTitle>
            <DialogDescription>
              Terkait laporan “{banTarget?.reason}” dari {banTarget?.reporter.name}. Driver tidak bisa online atau
              menerima pesanan baru; dia menerima notifikasi berisi alasan ini. Laporan otomatis ditutup.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ban-reason" className="font-semibold">
              Alasan pemblokiran (wajib)
            </Label>
            <Input
              id="ban-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="cth: Meminta pembayaran di luar tarif resmi"
              className="border-2"
              maxLength={200}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">{reason.trim().length}/200 karakter — minimal 4.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanTarget(null)} className="border-2 font-bold">
              Batal
            </Button>
            <Button onClick={submitBan} disabled={banBusy || reason.trim().length < 4} className="gap-2 bg-red-600 font-extrabold hover:bg-red-700">
              {banBusy ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />}
              Ya, Blokir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
