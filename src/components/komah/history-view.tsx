"use client";

import { ChevronRight, Clock, Inbox, Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dateLabel, navigate, rupiah, stashPrefill, timeId, useApi } from "./lib";
import { EmptyState, StatusBadge, TypeIcon } from "./bits";
import type { OrderT } from "@/lib/types";

export function HistoryView() {
  const { data, loading } = useApi<{ orders: OrderT[] }>("/api/orders");

  function repeat(o: OrderT) {
    stashPrefill({
      type: o.type,
      pickup: o.pickupLocation,
      dest: o.destLocation,
      pickupDetail: o.pickupDetail || "",
      destDetail: o.destDetail || "",
      itemNote: o.itemNote || "",
      passengerNote: o.passengerNote || "",
    });
    navigate(`/pesan?type=${o.type}`);
  }

  const groups: Array<{ label: string; orders: OrderT[] }> = [];
  for (const o of data?.orders || []) {
    const label = dateLabel(o.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.orders.push(o);
    else groups.push({ label, orders: [o] });
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-6 sm:px-6">
      <h1 className="text-xl font-extrabold sm:text-2xl">Riwayat Pesanan</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Semua pesanan yang pernah kamu buat di KOMAH.</p>

      <div className="mt-6 space-y-7">
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        )}

        {!loading && (data?.orders || []).length === 0 && (
          <EmptyState
            icon={<Inbox size={26} />}
            title="Belum ada pesanan"
            desc="Pesanan ojek dan antar barangmu akan tercatat di sini. Yuk, coba pesan pertamamu!"
            action={
              <Button onClick={() => navigate("/pesan")} className="gap-2 bg-unp font-bold hover:bg-unp-dark">
                Pesan Sekarang
              </Button>
            }
          />
        )}

        {groups.map((g) => (
          <section key={g.label}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
              <Clock size={14} /> {g.label}
            </h2>
            <div className="space-y-3">
              {g.orders.map((o) => (
                <div key={o.id} className="flex items-stretch gap-2.5">
                  <button
                    onClick={() => navigate(`/pesanan/${o.code}`)}
                    className="flex min-w-0 flex-1 items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-unp/40 hover:shadow-md"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-unp-soft">
                      <TypeIcon type={o.type} size={22} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">
                        {o.pickupLocation.name} → {o.destLocation.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {o.code} • {timeId(o.createdAt)} WIB
                        {o.driver ? ` • Driver: ${o.driver.name}` : ""}
                      </p>
                      <div className="mt-2">
                        <StatusBadge status={o.status} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="font-extrabold text-unp">{rupiah(o.fare)}</span>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                  </button>
                  <button
                    onClick={() => repeat(o)}
                    disabled={o.status === "MENCARI" || o.status === "DIKONFIRMASI" || o.status === "BERJALAN"}
                    className="flex w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-unp/30 bg-unp-soft text-unp-dark transition-all hover:border-unp hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Pesan lagi rute yang sama"
                    title="Pesan lagi rute yang sama"
                  >
                    <Repeat2 size={18} />
                    <span className="text-[9px] font-extrabold leading-none">Ulangi</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
