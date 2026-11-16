"use client";

// Kelola Tarif (admin) — seluruh angka daftar harga resmi KOMAH dalam SATU
// tabel jarak tempuh yang menyambung (persis daftar resmi: "dari km" =
// batas bawah rentang), tambahan hujan per rentang jarak, dan surcharge
// antar makanan (porsi, tempat pembelian, waktu tunggu, jam malam).
// Perubahan divalidasi server dan berlaku untuk pesanan BARU; pesanan lama
// memakai rincian yang tersimpan di pesanannya. Panel ini juga menyediakan
// uji hitung langsung (jarak + skenario MAKANAN) sebelum disimpan.
//
// Tombol Simpan menempel di bawah layar (sticky) agar selalu terjangkau
// jempol di ponsel tanpa perlu scroll, dan setiap baris punya tombol hapus.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw, Save, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiCall, rupiah, useApi } from "./lib";
import { EmptyState } from "./bits";
import {
  calcOfficialFare,
  DEFAULT_FARE_CONFIG,
  type FareConfig,
} from "@/lib/fare";

type Row = { from: string; add: string };
type DistRow = { from: string; fare: string };
type RainRow = { upTo: string; add: string };

function toRows(steps: Array<{ from: number; add: number }>): Row[] {
  return steps.map((s) => ({ from: String(s.from), add: String(s.add) }));
}
function toDistRows(rows: Array<{ fromKm: number; fare: number }>): DistRow[] {
  return rows.map((r) => ({ from: String(r.fromKm), fare: String(r.fare) }));
}

function parseNum(s: string): number {
  return Number(String(s).replace(/\./g, "").replace(",", "."));
}
function parseKm(s: string): number {
  return Number(String(s).replace(",", "."));
}

// Parse baris form → struktur config. Baris kosong diabaikan; baris salah
// format melempar error dengan pesan lokasi (admin melihat persis mana yang salah).
function parseSteps(rows: Row[], what: string): Array<{ from: number; add: number }> {
  const out: Array<{ from: number; add: number }> = [];
  rows.forEach((r, i) => {
    if (!r.from.trim() && !r.add.trim()) return;
    const from = Number(r.from.replace(",", "."));
    const add = parseNum(r.add);
    if (!Number.isFinite(from) || from <= 0) throw new Error(`${what}, baris ${i + 1}: angka "dari" tidak valid.`);
    if (!Number.isFinite(add) || add < 0) throw new Error(`${what}, baris ${i + 1}: tambahan Rp tidak valid.`);
    out.push({ from, add });
  });
  if (out.length === 0) throw new Error(`${what}: minimal satu baris terisi.`);
  out.sort((a, b) => b.from - a.from);
  return out;
}

function parseDistance(rows: DistRow[]): Array<{ fromKm: number; fare: number }> {
  const out: Array<{ fromKm: number; fare: number }> = [];
  rows.forEach((r, i) => {
    if (!r.from.trim() && !r.fare.trim()) return;
    const fromKm = parseKm(r.from);
    const fare = parseNum(r.fare);
    if (!Number.isFinite(fromKm) || fromKm <= 0 || fromKm > 100) throw new Error(`Tabel jarak, baris ${i + 1}: "dari km" harus 0,1–100.`);
    if (!Number.isFinite(fare) || fare < 1000) throw new Error(`Tabel jarak, baris ${i + 1}: tarif minimal Rp1.000.`);
    out.push({ fromKm, fare });
  });
  if (out.length === 0) throw new Error("Tabel jarak: minimal satu baris terisi.");
  out.sort((a, b) => a.fromKm - b.fromKm);
  return out;
}

function parseRain(bounded: RainRow[], above: string): Array<{ upTo: number | null; add: number }> {
  const out: Array<{ upTo: number; add: number }> = [];
  bounded.forEach((r, i) => {
    if (!r.upTo.trim() && !r.add.trim()) return;
    const upTo = parseKm(r.upTo);
    const add = parseNum(r.add);
    if (!Number.isFinite(upTo) || upTo <= 0 || upTo > 100) throw new Error(`Hujan, baris ${i + 1}: batas km harus 0,1–100.`);
    if (!Number.isFinite(add) || add < 0) throw new Error(`Hujan, baris ${i + 1}: tambahan Rp tidak valid.`);
    out.push({ upTo, add });
  });
  const aboveAdd = parseNum(above);
  if (!Number.isFinite(aboveAdd) || aboveAdd < 0) throw new Error("Hujan: tambahan di atas batas terakhir tidak valid.");
  out.sort((a, b) => a.upTo - b.upTo);
  return [...out, { upTo: null, add: aboveAdd }];
}

// Ubah satu baris array state (immutable) + tandai form kotor.
function editRow<T extends object>(arr: T[], set: (v: T[]) => void, i: number, patch: Partial<T>, markDirty: () => void) {
  const next = [...arr];
  next[i] = { ...next[i], ...patch };
  set(next);
  markDirty();
}

export function AdminFareView() {
  const { toast } = useToast();
  const { data, loading, error } = useApi<{ config: FareConfig }>("/api/admin/fare-config");

  const [distRows, setDistRows] = useState<DistRow[]>([]);
  const [overMaxBase, setOverMaxBase] = useState("");
  const [overMaxPerKm, setOverMaxPerKm] = useState("");
  const [rainBounded, setRainBounded] = useState<RainRow[]>([]);
  const [rainAbove, setRainAbove] = useState("");
  const [foodRainFlat, setFoodRainFlat] = useState("");
  const [portionSteps, setPortionSteps] = useState<Row[]>([]);
  const [placeSteps, setPlaceSteps] = useState<Row[]>([]);
  const [waitingSteps, setWaitingSteps] = useState<Row[]>([]);
  const [night2230, setNight2230] = useState("");
  const [night2300, setNight2300] = useState("");
  const [night0000, setNight0000] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const markDirty = () => setDirty(true);

  // Uji hitung langsung (skenario) — memakai config hasil parse form.
  const [testKm, setTestKm] = useState("3.5");
  const [testType, setTestType] = useState<"OJEK" | "MAKANAN">("OJEK");
  const [testRain, setTestRain] = useState(false);
  const [testPortions, setTestPortions] = useState("2");
  const [testPlaces, setTestPlaces] = useState("1");
  const [testWaiting, setTestWaiting] = useState("0");

  // Isi form dari config server (sekali per muatan).
  useEffect(() => {
    if (!data) return;
    const c = data.config;
    setDistRows(toDistRows(c.distance));
    setOverMaxBase(String(c.overMaxBase));
    setOverMaxPerKm(String(c.overMaxPerKm));
    setRainBounded(c.rainTiers.filter((t) => t.upTo !== null).map((t) => ({ upTo: String(t.upTo), add: String(t.add) })));
    setRainAbove(String(c.rainTiers.find((t) => t.upTo === null)?.add ?? 0));
    setFoodRainFlat(String(c.foodRainFlat));
    setPortionSteps(toRows(c.portionSteps));
    setPlaceSteps(toRows(c.placeSteps));
    setWaitingSteps(toRows(c.waitingSteps));
    setNight2230(String(c.night2230));
    setNight2300(String(c.night2300));
    setNight0000(String(c.night0000));
    setDirty(false);
  }, [data]);

  const parsed = useMemo<{ cfg: FareConfig } | { err: string } | null>(() => {
    if (!data) return null;
    try {
      const cfg: FareConfig = {
        distance: parseDistance(distRows),
        overMaxBase: parseNum(overMaxBase) || 0,
        overMaxPerKm: parseNum(overMaxPerKm) || 0,
        rainTiers: parseRain(rainBounded, rainAbove),
        foodRainFlat: parseNum(foodRainFlat) || 0,
        portionSteps: parseSteps(portionSteps, "Porsi"),
        placeSteps: parseSteps(placeSteps, "Tempat pembelian"),
        waitingSteps: parseSteps(waitingSteps, "Waktu tunggu"),
        night2230: parseNum(night2230) || 0,
        night2300: parseNum(night2300) || 0,
        night0000: parseNum(night0000) || 0,
      };
      return { cfg };
    } catch (e) {
      return { err: e instanceof Error ? e.message : "Ada angka yang belum valid." };
    }
  }, [data, distRows, overMaxBase, overMaxPerKm, rainBounded, rainAbove, foodRainFlat, portionSteps, placeSteps, waitingSteps, night2230, night2300, night0000]);

  const testBreakdown = useMemo(() => {
    if (!parsed || !("cfg" in parsed)) return null;
    return calcOfficialFare(
      {
        distanceKm: parseKm(testKm) || 1,
        type: testType,
        rain: testRain,
        portions: testType === "MAKANAN" ? Math.max(1, Number(testPortions) || 1) : undefined,
        places: testType === "MAKANAN" ? Math.max(1, Number(testPlaces) || 1) : undefined,
        waitingMinutes: testType === "MAKANAN" ? Math.max(0, Number(testWaiting) || 0) : undefined,
      },
      parsed.cfg
    );
  }, [parsed, testKm, testType, testRain, testPortions, testPlaces, testWaiting]);

  async function save() {
    if (!parsed || !("cfg" in parsed)) return;
    setBusy(true);
    const { ok, data: res } = await apiCall<{ message: string }>("/api/admin/fare-config", "PUT", { config: parsed.cfg });
    setBusy(false);
    if (!ok) {
      toast({ title: "Gagal menyimpan tarif", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Tarif tersimpan", description: res.message });
    setDirty(false);
  }

  function resetDefault() {
    const c = DEFAULT_FARE_CONFIG;
    setDistRows(toDistRows(c.distance));
    setOverMaxBase(String(c.overMaxBase));
    setOverMaxPerKm(String(c.overMaxPerKm));
    setRainBounded(c.rainTiers.filter((t) => t.upTo !== null).map((t) => ({ upTo: String(t.upTo), add: String(t.add) })));
    setRainAbove(String(c.rainTiers.find((t) => t.upTo === null)?.add ?? 0));
    setFoodRainFlat(String(c.foodRainFlat));
    setPortionSteps(toRows(c.portionSteps));
    setPlaceSteps(toRows(c.placeSteps));
    setWaitingSteps(toRows(c.waitingSteps));
    setNight2230(String(c.night2230));
    setNight2300(String(c.night2300));
    setNight0000(String(c.night0000));
    setDirty(true);
  }

  const inputCls = "h-10 border-2 font-semibold";
  const parseErr = parsed && !("cfg" in parsed) ? parsed.err : null;

  // Label batas "di atas km" untuk hujan & tabel jarak (tampilan saja).
  const lastDistKm = useMemo(() => {
    const vals = distRows.map((r) => parseKm(r.from)).filter((v) => Number.isFinite(v) && v > 0);
    return vals.length ? Math.max(...vals) : null;
  }, [distRows]);
  const lastRainKm = useMemo(() => {
    const vals = rainBounded.map((r) => parseKm(r.upTo)).filter((v) => Number.isFinite(v) && v > 0);
    return vals.length ? Math.max(...vals) : null;
  }, [rainBounded]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-6 sm:px-6">
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-6 sm:px-6">
        <EmptyState icon={<AlertTriangle size={26} />} title="Gagal memuat tarif" desc={error || "Coba muat ulang halaman."} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 pt-6 sm:px-6">
      {/* Header */}
      <div className="rounded-3xl border-2 border-unp/30 bg-gradient-to-br from-unp-soft/60 to-card p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold-dark text-unp-deep shadow-md">
            <Wallet size={24} />
          </span>
          <div>
            <h1 className="text-lg font-extrabold">Kelola Tarif Resmi</h1>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Angka ini dipakai server untuk SEMUA pesanan baru. Pesanan lama memakai tarif yang sudah tersimpan di pesanannya.
            </p>
          </div>
        </div>
      </div>

      {/* 1) Tabel jarak tempuh — satu tabel menyambung */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">1 · Tarif jarak tempuh</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Satu tabel yang menyambung, persis daftar resmi: <b>dari 2,3 km ➜ Rp7.000</b> berarti 2,3–3,0 km dikenakan Rp7.000.
          Di bawah baris pertama memakai baris pertama (tarif minimum). Jarak dibulatkan ke atas per 0,1 km s.d. 10 km, di atasnya per km utuh.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {distRows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={r.from}
                onChange={(e) => editRow(distRows, setDistRows, i, { from: e.target.value }, markDirty)}
                inputMode="decimal"
                placeholder="dari km"
                className={cn(inputCls, "w-24")}
                aria-label={`Tabel jarak baris ${i + 1} dari km`}
              />
              <span className="shrink-0 text-xs font-bold text-muted-foreground">km →</span>
              <Input
                value={r.fare}
                onChange={(e) => editRow(distRows, setDistRows, i, { fare: e.target.value }, markDirty)}
                inputMode="numeric"
                placeholder="Rp"
                className={cn(inputCls, "min-w-0 flex-1")}
                aria-label={`Tabel jarak baris ${i + 1} tarif Rp`}
              />
              <button
                type="button"
                onClick={() => { setDistRows(distRows.filter((_, j) => j !== i)); markDirty(); }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label={`Hapus baris tabel jarak ${i + 1}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setDistRows([...distRows, { from: "", fare: "" }]); markDirty(); }} className="mt-2 text-xs font-bold text-unp">
          + Tambah baris
        </Button>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Di atas {lastDistKm ? `${lastDistKm} km` : "km terakhir"} — tarif dasar (Rp)</Label>
            <Input value={overMaxBase} onChange={(e) => { setOverMaxBase(e.target.value); markDirty(); }} inputMode="numeric" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Di atas {lastDistKm ? `${lastDistKm} km` : "km terakhir"} — per km berikutnya (Rp)</Label>
            <Input value={overMaxPerKm} onChange={(e) => { setOverMaxPerKm(e.target.value); markDirty(); }} inputMode="numeric" className={inputCls} />
          </div>
        </div>
      </section>

      {/* 2) Tambahan hujan per rentang jarak */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">2 · Tambahan hujan</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Berlaku bila pelanggan tetap minta jalan saat hujan — besar tambahan mengikuti rentang jarak.
          Bawaan resmi: s.d. 10 km ➜ +Rp2.000, di atasnya ➜ +Rp4.000.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {rainBounded.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-bold text-muted-foreground">s.d.</span>
              <Input
                value={r.upTo}
                onChange={(e) => editRow(rainBounded, setRainBounded, i, { upTo: e.target.value }, markDirty)}
                inputMode="decimal"
                placeholder="km"
                className={cn(inputCls, "w-20")}
                aria-label={`Hujan baris ${i + 1} batas km`}
              />
              <span className="shrink-0 text-xs font-bold text-muted-foreground">km → +</span>
              <Input
                value={r.add}
                onChange={(e) => editRow(rainBounded, setRainBounded, i, { add: e.target.value }, markDirty)}
                inputMode="numeric"
                placeholder="Rp"
                className={cn(inputCls, "min-w-0 flex-1")}
                aria-label={`Hujan baris ${i + 1} tambahan Rp`}
              />
              <button
                type="button"
                onClick={() => { setRainBounded(rainBounded.filter((_, j) => j !== i)); markDirty(); }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label={`Hapus rentang hujan ${i + 1}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setRainBounded([...rainBounded, { upTo: "", add: "" }]); markDirty(); }} className="mt-2 text-xs font-bold text-unp">
          + Tambah rentang
        </Button>
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-muted/60 p-2.5">
          <span className="shrink-0 text-xs font-bold text-muted-foreground">
            {lastRainKm ? `Di atas ${lastRainKm} km → +` : "Semua jarak → +"}
          </span>
          <Input
            value={rainAbove}
            onChange={(e) => { setRainAbove(e.target.value); markDirty(); }}
            inputMode="numeric"
            placeholder="Rp"
            className={cn(inputCls, "min-w-0 flex-1 bg-card")}
            aria-label="Tambahan hujan di atas batas terakhir"
          />
        </div>
      </section>

      {/* 3) Aturan Food Delivery */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">3 · Aturan antar MAKANAN</h2>
        <p className="mt-1 text-xs text-muted-foreground">Porsi, tempat pembelian, waktu tunggu, hujan flat, dan jam malam — hanya layanan MAKANAN.</p>

        <div className="mt-4 space-y-1.5">
          <Label className="text-xs font-bold">Hujan flat MAKANAN (Rp) — di luar rentang hujan di atas</Label>
          <Input value={foodRainFlat} onChange={(e) => { setFoodRainFlat(e.target.value); markDirty(); }} inputMode="numeric" className={cn(inputCls, "max-w-40")} />
        </div>

        {(
          [
            { title: "Porsi — dari jumlah porsi", rows: portionSteps, set: setPortionSteps },
            { title: "Tempat pembelian — dari tempat ke-N", rows: placeSteps, set: setPlaceSteps },
            { title: "Waktu tunggu — dari menit ke-N", rows: waitingSteps, set: setWaitingSteps },
          ] as Array<{ title: string; rows: Row[]; set: (r: Row[]) => void }>
        ).map((grp) => (
          <div key={grp.title} className="mt-4">
            <p className="text-xs font-bold">{grp.title}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {grp.rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={r.from}
                    onChange={(e) => editRow(grp.rows, grp.set, i, { from: e.target.value }, markDirty)}
                    inputMode="numeric"
                    placeholder="dari"
                    className={cn(inputCls, "w-24")}
                    aria-label={`${grp.title} baris ${i + 1} dari`}
                  />
                  <span className="shrink-0 text-xs font-bold text-muted-foreground">→ +</span>
                  <Input
                    value={r.add}
                    onChange={(e) => editRow(grp.rows, grp.set, i, { add: e.target.value }, markDirty)}
                    inputMode="numeric"
                    placeholder="Rp"
                    className={cn(inputCls, "min-w-0 flex-1")}
                    aria-label={`${grp.title} baris ${i + 1} tambahan`}
                  />
                  <button
                    type="button"
                    onClick={() => { grp.set(grp.rows.filter((_, j) => j !== i)); markDirty(); }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label={`Hapus baris ${grp.title} ${i + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => { grp.set([...grp.rows, { from: "", add: "" }]); markDirty(); }} className="mt-1.5 text-xs font-bold text-unp">
              + Tambah baris
            </Button>
          </div>
        ))}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Jam malam 22:30 (Rp)</Label>
            <Input value={night2230} onChange={(e) => { setNight2230(e.target.value); markDirty(); }} inputMode="numeric" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Jam malam 23:00 (Rp)</Label>
            <Input value={night2300} onChange={(e) => { setNight2300(e.target.value); markDirty(); }} inputMode="numeric" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Jam malam 00:00–05:00 (Rp)</Label>
            <Input value={night0000} onChange={(e) => { setNight0000(e.target.value); markDirty(); }} inputMode="numeric" className={inputCls} />
          </div>
        </div>
      </section>

      {/* 4) Uji hitung */}
      <section className="rounded-3xl border-2 border-gold/50 bg-gold-soft/40 p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-unp-deep">4 · Uji hitung (angka form saat ini)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Jarak (km)</Label>
            <Input value={testKm} onChange={(e) => setTestKm(e.target.value)} inputMode="decimal" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Layanan</Label>
            <div className="flex gap-2">
              {(["OJEK", "MAKANAN"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTestType(t)}
                  aria-pressed={testType === t}
                  className={cn(
                    "flex-1 rounded-xl border-2 px-2 py-2 text-xs font-extrabold",
                    testType === t ? "border-unp bg-unp-soft text-unp-dark" : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Hujan</Label>
            <button
              type="button"
              onClick={() => setTestRain((v) => !v)}
              aria-pressed={testRain}
              className={cn(
                "h-10 w-full rounded-xl border-2 text-xs font-extrabold",
                testRain ? "border-unp bg-unp-soft text-unp-dark" : "border-border bg-card text-muted-foreground"
              )}
            >
              {testRain ? "Ya" : "Tidak"}
            </button>
          </div>
        </div>
        {testType === "MAKANAN" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Porsi</Label>
              <Input value={testPortions} onChange={(e) => setTestPortions(e.target.value)} inputMode="numeric" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Tempat</Label>
              <Input value={testPlaces} onChange={(e) => setTestPlaces(e.target.value)} inputMode="numeric" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Tunggu (mnt)</Label>
              <Input value={testWaiting} onChange={(e) => setTestWaiting(e.target.value)} inputMode="numeric" className={inputCls} />
            </div>
          </div>
        )}
        {testBreakdown && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 font-semibold">
              <span>Jarak: <b>{testBreakdown.distanceKm} km</b></span>
              <span>Dasar: <b>{rupiah(testBreakdown.base)}</b></span>
              {testBreakdown.rain > 0 && <span>Hujan: <b>{rupiah(testBreakdown.rain)}</b></span>}
              {testBreakdown.foodRain > 0 && <span>Hujan makanan: <b>{rupiah(testBreakdown.foodRain)}</b></span>}
              {testBreakdown.portions > 0 && <span>Porsi: <b>{rupiah(testBreakdown.portions)}</b></span>}
              {testBreakdown.places > 0 && <span>Tempat: <b>{rupiah(testBreakdown.places)}</b></span>}
              {testBreakdown.waiting > 0 && <span>Tunggu: <b>{rupiah(testBreakdown.waiting)}</b></span>}
              {testBreakdown.night > 0 && <span>Jam malam: <b>{rupiah(testBreakdown.night)}</b></span>}
            </div>
            <p className="mt-2 text-lg font-extrabold text-unp-dark">Total: {rupiah(testBreakdown.total)}</p>
          </div>
        )}
      </section>

      {/* Bar simpan menempel di bawah — selalu terjangkau jempol di ponsel.
          marginTop inline:0 meniadakan space-y agar tidak ada celah tembus
          pandang di atas bar saat menempel. */}
      <div
        className="sticky bottom-0 z-30 -mx-4 border-t border-border/70 bg-background/95 px-4 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-6 sm:px-6"
        style={{ marginTop: 0 }}
      >
        {parseErr && (
          <p className="mb-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {parseErr}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={resetDefault} className="w-full gap-2 border-2 font-bold sm:w-auto">
            <RotateCcw size={15} /> Kembalikan Bawaan
          </Button>
          <Button
            onClick={save}
            disabled={busy || !!parseErr || !dirty}
            className="w-full gap-2 bg-gold font-extrabold hover:bg-gold-dark sm:w-auto"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {dirty ? "Simpan Tarif" : "Tersimpan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
