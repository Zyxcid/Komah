"use client";

// Monitor pesanan (admin) — pengawasan pesanan lintas pengguna: pesanan
// aktif (mencari/berjalan), selesai, dan dibatalkan. Admin dapat
// membatalkan pesanan bermasalah (mis. nyangkut tanpa driver) — penumpang
// dan driver terkait menerima notifikasi.

import { useMemo, useState } from "react";
import { AlertTriangle, Ban, Loader2, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { apiCall, rupiah, timeId, useApi } from "./lib";
import { EmptyState, StatusBadge, TypeIcon } from "./bits";
import type { AdminOrderT } from "@/lib/types";

type Filter = "aktif" | "selesai" | "dibatalkan";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "aktif", label: "Aktif" },
  { key: "selesai", label: "Selesai" },
  { key: "dibatalkan", label: "Dibatalkan" },
];

export function AdminOrdersView() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("aktif");
  const { data, refetch, loading, error } = useApi<{ orders: AdminOrderT[] }>(`/api/admin/orders?status=${filter}`, {
    interval: 10000,
  });
  const orders = data?.orders || [];
  const [busyId, setBusyId] = useState<string | null>(null);

  const cancellable = useMemo(() => (o: AdminOrderT) => ["MENCARI", "DIKONFIRMASI"].includes(o.status), []);

  async function cancelOrder(o: AdminOrderT) {
    setBusyId(o.id);
    const { ok, data: res } = await apiCall(`/api/orders/${o.id}`, "PATCH", { action: "cancel" });
    setBusyId(null);
    if (!ok) {
      toast({ title: "Gagal membatalkan", description: res.error, variant: "destructive" });
      refetch();
      return;
    }
    toast({ title: "Pesanan dibatalkan", description: `${o.code} — penumpang & driver telah diberi tahu.` });
    refetch();
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-10 pt-6 sm:px-6">
      {/* Filter status */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
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
            {f.key === "aktif" && orders.length > 0 && (
              <span className="ml-1.5 rounded-full bg-unp px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                {orders.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error ? (
        <EmptyState
          icon={<AlertTriangle size={26} />}
          title="Gagal memuat pesanan"
          desc={`${error} Coba muat ulang; bila berlanjut, jalankan npm run db:push dan periksa log server.`}
        />
      ) : loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ReceiptText size={26} />}
          title={filter === "aktif" ? "Tidak ada pesanan aktif" : "Belum ada pesanan di kategori ini"}
          desc={filter === "aktif" ? "Pesanan baru dari penumpang akan muncul di sini secara langsung." : "Coba kategori lain."}
        />
      ) : (
        <div className="space-y-2.5">
          {orders.map((o) => (
            <div
              key={o.id}
              className={cn(
                "rounded-2xl border bg-card p-4 shadow-sm",
                cancellable(o) ? "border-unp/25" : "border-border"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-unp-soft text-unp">
                  <TypeIcon type={o.type} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold">{o.code}</p>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {o.pickupLocation.name} → {o.destLocation.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.user.name}
                    {o.driver ? ` • Driver: ${o.driver.name}` : " • Belum ada driver"} • {timeId(o.createdAt)} WIB
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-extrabold text-unp">{rupiah(o.fare)}</p>
                  {o.rating != null && (
                    <p className="text-[11px] font-bold text-gold-dark">★ {o.rating}</p>
                  )}
                </div>
                {cancellable(o) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        disabled={busyId === o.id}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label={`Batalkan ${o.code}`}
                      >
                        {busyId === o.id ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <Ban size={17} className="text-red-600" /> Batalkan pesanan {o.code}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Pesanan {o.user.name}
                          {o.driver ? ` (driver: ${o.driver.name})` : ""} akan dibatalkan dan tidak bisa
                          dilanjutkan lagi. Penumpang dan driver menerima notifikasi pembatalan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => cancelOrder(o)} className="bg-red-600 hover:bg-red-700">
                          Ya, Batalkan
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        Menampilkan maks. 50 pesanan terbaru per kategori (diperbarui otomatis tiap 10 detik).
        {" "}Status aktif = mencari driver, dikonfirmasi, atau sedang berjalan.
      </p>
    </div>
  );
}
