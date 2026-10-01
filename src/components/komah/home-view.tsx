"use client";

import {
  Bike,
  ChevronRight,
  History,
  MapPin,
  Package,
  Repeat2,
  UtensilsCrossed,
} from "lucide-react";
import { apiCall, navigate, rupiah, stashPrefill, STATUS_META, timeId, useApi, useAuth } from "./lib";
import { StatusBadge, TypeIcon } from "./bits";
import type { OrderT } from "@/lib/types";

const SERVICES = [
  { type: "OJEK", label: "Ojek", desc: "Antar kamu", icon: Bike },
  { type: "BARANG", label: "Antar Barang", desc: "Titip antar", icon: Package },
  { type: "MAKANAN", label: "Antar Makanan", desc: "Kantin & warung", icon: UtensilsCrossed },
] as const;

export function HomeView() {
  const { me, activeOrder, refresh } = useAuth();
  const { data: orderData } = useApi<{ orders: OrderT[] }>("/api/orders");
  const orders = orderData?.orders || [];

  const hour = new Date().getHours();
  const greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";

  // Pesanan terakhir yang bukan pesanan aktif — calon kandidat "Pesan lagi".
  const lastOrder = activeOrder ? orders.find((o) => o.id !== activeOrder.id) || null : orders[0] || null;

  // Driver terverifikasi di mode penumpang — tawaran mulai menerima pesanan.
  const showDriverCta =
    me?.role === "DRIVER" && me?.verifyStatus === "VERIFIED" && !activeOrder;

  function repeatOrder(o: OrderT) {
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

  async function startDriving() {
    const { ok, data } = await apiCall("/api/profile", "PATCH", { appMode: "DRIVER" });
    if (!ok) {
      navigate("/mode-driver");
      return;
    }
    await refresh();
    navigate("/mode-driver");
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-10 pt-6 sm:px-6">
      {/* Sapaan ringkas — teks saja, tanpa tombol (profil ada di tab & menu avatar) */}
      <div>
        <p className="text-sm text-muted-foreground">{greet},</p>
        <h1 className="text-xl font-extrabold leading-tight sm:text-2xl">{me?.name}</h1>
      </div>

      {/* Pesanan aktif — info paling penting, selalu di atas */}
      {activeOrder && (
        <button
          onClick={() => navigate(`/pesanan/${activeOrder.code}`)}
          className="block w-full overflow-hidden rounded-3xl border-2 border-unp/30 bg-gradient-to-br from-unp-soft/70 to-card p-5 text-left shadow-sm transition-all hover:shadow-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="relative flex h-3 w-3 shrink-0 rounded-full bg-unp text-unp pulse-ring" />
              <span className="truncate text-sm font-extrabold text-unp-dark">
                {STATUS_META[activeOrder.status].short} — {activeOrder.code}
              </span>
            </div>
            <ChevronRight size={18} className="shrink-0 text-unp" />
          </div>
          <div className="mt-3.5 flex items-center gap-3">
            <div className="flex flex-col items-center self-stretch pt-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-unp" />
              <span className="my-1 w-0.5 flex-1 bg-gradient-to-b from-unp to-gold" />
              <span className="h-2.5 w-2.5 rounded-full bg-gold" />
            </div>
            <div className="min-w-0 flex-1 space-y-2 text-sm">
              <p className="truncate font-bold">{activeOrder.pickupLocation.name}</p>
              <p className="truncate font-bold">{activeOrder.destLocation.name}</p>
            </div>
            <div className="shrink-0 text-right">
              <StatusBadge status={activeOrder.status} />
              <p className="mt-2 text-base font-extrabold text-unp-dark">{rupiah(activeOrder.fare)}</p>
              {activeOrder.driver && (
                <p className="mt-0.5 max-w-28 truncate text-[11px] text-muted-foreground">Driver: {activeOrder.driver.name}</p>
              )}
            </div>
          </div>
        </button>
      )}

      {/* Aksi cepat — langsung ke langkah rute, tanpa basa-basi */}
      <section>
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">Pesan cepat</h2>
        <div className="grid grid-cols-3 gap-3">
          {SERVICES.map((s) => (
            <button
              key={s.type}
              onClick={() => navigate(`/pesan?type=${s.type}`)}
              className="rounded-3xl border border-border bg-card p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-unp/40 hover:shadow-md"
            >
              <span
                className={
                  "mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md " +
                  (s.type === "MAKANAN"
                    ? "bg-gradient-to-br from-gold to-gold-dark shadow-gold/25"
                    : "bg-gradient-to-br from-unp to-unp-dark shadow-unp/25")
                }
              >
                <s.icon size={22} />
              </span>
              <p className="mt-2.5 text-sm font-extrabold leading-tight">{s.label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{s.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Pesanan terakhir + aksi ulangi */}
      {lastOrder && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">Terakhir</h2>
            <button onClick={() => navigate("/riwayat")} className="flex items-center gap-1 text-xs font-bold text-unp hover:underline">
              <History size={13} /> Riwayat
            </button>
          </div>
          <div className="flex items-stretch gap-2.5">
            <button
              onClick={() => navigate(`/pesanan/${lastOrder.code}`)}
              className="flex min-w-0 flex-1 items-center gap-3.5 rounded-3xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-unp/40 hover:shadow-md"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-unp-soft">
                <TypeIcon type={lastOrder.type} size={21} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">
                  {lastOrder.pickupLocation.name} → {lastOrder.destLocation.name}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {timeId(lastOrder.createdAt)} WIB · {rupiah(lastOrder.fare)}
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
            </button>
            <button
              onClick={() => repeatOrder(lastOrder)}
              className="flex w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-3xl border-2 border-unp/30 bg-unp-soft text-unp-dark transition-all hover:border-unp hover:shadow-md"
              aria-label="Pesan lagi rute yang sama"
              title="Pesan lagi rute yang sama"
            >
              <Repeat2 size={20} />
              <span className="text-[10px] font-extrabold leading-none">Pesan lagi</span>
            </button>
          </div>
        </section>
      )}

      {/* Driver di mode penumpang — tawaran mulai menerima pesanan */}
      {showDriverCta && (
        <button
          onClick={startDriving}
          className="flex w-full items-center gap-3.5 rounded-3xl border-2 border-dashed border-unp/40 bg-unp-soft/30 p-5 text-left transition-all hover:border-unp hover:bg-unp-soft/50"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-unp to-unp-dark text-white shadow-md">
            <Bike size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold text-unp-deep">Punya waktu luang?</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Mulai terima pesanan di dashboard driver.</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-unp" />
        </button>
      )}

      {/* Satu baris info fungsi — bukan blok promosi */}
      <p className="pt-1 text-center text-[11px] leading-relaxed text-muted-foreground">
        Tarif tetap berbasis zona &middot; bayar tunai saat sampai tujuan.
      </p>
    </div>
  );
}
