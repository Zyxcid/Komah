"use client";

// Kelola Tarif (admin) — seluruh angka daftar harga resmi KOMAH: tingkat
// jarak tempuh, tarif per km 11–25, di atas 25 km, dan semua surcharge
// (hujan, porsi, tempat pembelian, waktu tunggu, jam malam). Perubahan
// divalidasi server dan berlaku untuk pesanan BARU; pesanan lama memakai
// rincian yang tersimpan di pesanannya. Panel ini juga menyiapkan input
// untuk uji hitung langsung (jarak + skenario MAKANAN) sebelum disimpan.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw, Save, Wallet } from "lucide-react";
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
type TierRow = { upTo: string; fare: string };

function toRows(steps: Array<{ from: number; add: number }>): Row[] {
  return steps.map((s) => ({ from: String(s.from), add: String(s.add) }));
}
function toTierRows(tiers: Array<{ upTo: number; fare: number }>): TierRow[] {
  return tiers.map((t) => ({ upTo: String(t.upTo), fare: String(t.fare) }));
}

// Parse baris form → struktur config. Baris kosong diabaikan; baris salah
// format membuat pesan error (admin melihat persis mana yang salah).
function parseSteps(rows: Row[], what: string): { ok: true; steps: Array<{ from: number; add: number }> } | { ok: false; err: string } {
  const out: Array<{ from: number; add: number }> = [];
  for (const r of rows) {
    if (!r.from.trim() && !r.add.trim()) continue;
    const from = Number(r.from.replace(",", "."));
    const add = Number(r.add.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(from) || from <= 0) return { ok: false, err: `Baris ${what}: angka "dari" tidak valid.` };
    if (!Number.isFinite(add) || add < 0) return { ok: false, err: `Baris ${what}: tambahan Rp tidak valid.` };
    out.push({ from, add });
  }
  if (out.length === 0) return { ok: false, err: `${what}: minimal satu baris.` };
  out.sort((a, b) => b.from - a.from);
  return { ok: true, steps: out };
}

function parseTiers(rows: TierRow[]): { ok: true; tiers: Array<{ upTo: number; fare: number }> } | { ok: false; err: string } {
  const out: Array<{ upTo: number; fare: number }> = [];
  for (const r of rows) {
    if (!r.upTo.trim() && !r.fare.trim()) continue;
    const upTo = Number(r.upTo.replace(",", "."));
    const fare = Number(r.fare.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(upTo) || upTo <= 0 || upTo > 100) return { ok: false, err: `Tingkat jarak: batas km tidak valid (0,1–100).` };
    if (!Number.isFinite(fare) || fare < 1000) return { ok: false, err: `Tingkat jarak: tarif minimal Rp1.000.` };
    out.push({ upTo, fare });
  }
  if (out.length === 0) return { ok: false, err: "Tingkat jarak: minimal satu baris." };
  out.sort((a, b) => a.upTo - b.upTo);
  return { ok: true, tiers: out };
}

export function AdminFareView() {
  const { toast } = useToast();
  const { data, loading, error } = useApi<{ config: FareConfig }>("/api/admin/fare-config");

  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [kmFare, setKmFare] = useState<Row[]>([]);
  const [over25Base, setOver25Base] = useState("");
  const [over25PerKm, setOver25PerKm] = useState("");
  const [rainShort, setRainShort] = useState("");
  const [rainLong, setRainLong] = useState("");
  const [rainKmLimit, setRainKmLimit] = useState("");
  const [foodRainFlat, setFoodRainFlat] = useState("");
  const [portionSteps, setPortionSteps] = useState<Row[]>([]);
  const [placeSteps, setPlaceSteps] = useState<Row[]>([]);
  const [waitingSteps, setWaitingSteps] = useState<Row[]>([]);
  const [night2230, setNight2230] = useState("");
  const [night2300, setNight2300] = useState("");
  const [night0000, setNight0000] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

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
    setTiers(toTierRows(c.tiers));
    setKmFare(c.kmFare.map((k) => ({ from: String(k.km), add: String(k.fare) })));
    setOver25Base(String(c.over25Base));
    setOver25PerKm(String(c.over25PerKm));
    setRainShort(String(c.rainShort));
    setRainLong(String(c.rainLong));
    setRainKmLimit(String(c.rainKmLimit));
    setFoodRainFlat(String(c.foodRainFlat));
    setPortionSteps(toRows(c.portionSteps));
    setPlaceSteps(toRows(c.placeSteps));
    setWaitingSteps(toRows(c.waitingSteps));
    setNight2230(String(c.night2230));
    setNight2300(String(c.night2300));
    setNight0000(String(c.night0000));
    setDirty(false);
  }, [data]);

  const parsed = useMemo(() => {
    if (!data) return null;
    const t = parseTiers(tiers);
    if (!t.ok) return { err: t.err };
    const k = parseSteps(kmFare, "Tarif per km");
    if (!k.ok) return { err: k.err };
    const p = parseSteps(portionSteps, "Porsi");
    if (!p.ok) return { err: p.err };
    const pl = parseSteps(placeSteps, "Tempat pembelian");
    if (!pl.ok) return { err: pl.err };
    const w = parseSteps(waitingSteps, "Waktu tunggu");
    if (!w.ok) return { err: w.err };
    const cfg: FareConfig = {
      tiers: t.tiers,
      kmFare: k.steps.map((s) => ({ km: s.from, fare: s.add })),
      over25Base: Number(over25Base) || 0,
      over25PerKm: Number(over25PerKm) || 0,
      rainShort: Number(rainShort) || 0,
      rainLong: Number(rainLong) || 0,
      rainKmLimit: Number(rainKmLimit.replace(",", ".")) || 10,
      foodRainFlat: Number(foodRainFlat) || 0,
      portionSteps: p.steps,
      placeSteps: pl.steps,
      waitingSteps: w.steps,
      night2230: Number(night2230) || 0,
      night2300: Number(night2300) || 0,
      night0000: Number(night0000) || 0,
    };
    return { cfg };
  }, [data, tiers, kmFare, over25Base, over25PerKm, rainShort, rainLong, rainKmLimit, foodRainFlat, portionSteps, placeSteps, waitingSteps, night2230, night2300, night0000]);

  const testBreakdown = useMemo(() => {
    if (!parsed || !("cfg" in parsed) || !parsed.cfg) return null;
    return calcOfficialFare(
      {
        distanceKm: Number(testKm.replace(",", ".")) || 1,
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
    if (!parsed) return;
    if (!("cfg" in parsed) || !parsed.cfg) {
      toast({ title: "Ada angka belum valid", description: parsed.err, variant: "destructive" });
      return;
    }
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
    setTiers(toTierRows(c.tiers));
    setKmFare(c.kmFare.map((k) => ({ from: String(k.km), add: String(k.fare) })));
    setOver25Base(String(c.over25Base));
    setOver25PerKm(String(c.over25PerKm));
    setRainShort(String(c.rainShort));
    setRainLong(String(c.rainLong));
    setRainKmLimit(String(c.rainKmLimit));
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
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-10 pt-6 sm:px-6">
      {/* Header */}
      <div className="rounded-3xl border-2 border-unp/30 bg-gradient-to-br from-unp-soft/60 to-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold-dark text-unp-deep shadow-md">
              <Wallet size={24} />
            </span>
            <div>
              <h1 className="text-lg font-extrabold">Kelola Tarif Resmi</h1>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Angka ini dipakai server untuk SEMUA pesanan baru. Pesanan lama memakai tarif yang sudah tersimpan di pesanannya.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetDefault} className="gap-2 border-2 font-bold">
              <RotateCcw size={15} /> Kembalikan Bawaan
            </Button>
            <Button onClick={save} disabled={busy || !parsed || !("cfg" in parsed) || !dirty} className="gap-2 bg-gold font-extrabold hover:bg-gold-dark">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Tarif
            </Button>
          </div>
        </div>
        {parsed && !("cfg" in parsed) && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            <AlertTriangle size={14} /> {parsed.err}
          </p>
        )}
      </div>

      {/* 1) Tingkat jarak ≤10 km */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">1 · Tarif jarak tempuh (≤10 km)</h2>
        <p className="mt-1 text-xs text-muted-foreground">Jarak dibulatkan ke atas per 0,1 km; dipakai tingkat dengan batas ≥ jarak.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={t.upTo}
                onChange={(e) => { const next = [...tiers]; next[i] = { ...t, upTo: e.target.value }; setTiers(next); setDirty(true); }}
                inputMode="decimal"
                placeholder="km"
                className={cn(inputCls, "w-24")}
                aria-label={`Batas km baris ${i + 1}`}
              />
              <span className="text-xs font-bold text-muted-foreground">km →</span>
              <Input
                value={t.fare}
                onChange={(e) => { const next = [...tiers]; next[i] = { ...t, fare: e.target.value }; setTiers(next); setDirty(true); }}
                inputMode="numeric"
                placeholder="Rp"
                className={cn(inputCls, "flex-1")}
                aria-label={`Tarif Rp baris ${i + 1}`}
              />
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setTiers([...tiers, { upTo: "", fare: "" }]); setDirty(true); }} className="mt-2 text-xs font-bold text-unp">
          + Tambah tingkat
        </Button>
      </section>

      {/* 2) Per km utuh 11–25 & di atas 25 */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">2 · Jarak jauh (11–25 km &amp; lebih)</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {kmFare.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={t.from}
                onChange={(e) => { const next = [...kmFare]; next[i] = { ...t, from: e.target.value }; setKmFare(next); setDirty(true); }}
                inputMode="numeric"
                placeholder="km"
                className={cn(inputCls, "w-24")}
                aria-label={`km utuh baris ${i + 1}`}
              />
              <span className="text-xs font-bold text-muted-foreground">km →</span>
              <Input
                value={t.add}
                onChange={(e) => { const next = [...kmFare]; next[i] = { ...t, add: e.target.value }; setKmFare(next); setDirty(true); }}
                inputMode="numeric"
                className={cn(inputCls, "flex-1")}
                aria-label={`Tarif km baris ${i + 1}`}
              />
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setKmFare([...kmFare, { from: "", add: "" }]); setDirty(true); }} className="mt-2 text-xs font-bold text-unp">
          + Tambah baris km
        </Button>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Di atas 25 km — tarif dasar (Rp)</Label>
            <Input value={over25Base} onChange={(e) => { setOver25Base(e.target.value); setDirty(true); }} inputMode="numeric" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Di atas 25 km — per km berikutnya (Rp)</Label>
            <Input value={over25PerKm} onChange={(e) => { setOver25PerKm(e.target.value); setDirty(true); }} inputMode="numeric" className={inputCls} />
          </div>
        </div>
      </section>

      {/* 3) Hujan */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">3 · Tambahan hujan (semua layanan)</h2>
        <p className="mt-1 text-xs text-muted-foreground">Berlaku bila pelanggan tetap minta jalan saat hujan.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Jarak ≤ (km)</Label>
            <Input value={rainKmLimit} onChange={(e) => { setRainKmLimit(e.target.value); setDirty(true); }} inputMode="decimal" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Tambahan jarak pendek (Rp)</Label>
            <Input value={rainShort} onChange={(e) => { setRainShort(e.target.value); setDirty(true); }} inputMode="numeric" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Tambahan jarak jauh (Rp)</Label>
            <Input value={rainLong} onChange={(e) => { setRainLong(e.target.value); setDirty(true); }} inputMode="numeric" className={inputCls} />
          </div>
        </div>
      </section>

      {/* 4) Aturan Food Delivery */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">4 · Aturan antar MAKANAN</h2>
        <p className="mt-1 text-xs text-muted-foreground">Porsi, tempat pembelian, waktu tunggu, hujan flat, dan jam malam — hanya layanan MAKANAN.</p>

        <div className="mt-4 space-y-1.5">
          <Label className="text-xs font-bold">Hujan flat MAKANAN (Rp)</Label>
          <Input value={foodRainFlat} onChange={(e) => { setFoodRainFlat(e.target.value); setDirty(true); }} inputMode="numeric" className={cn(inputCls, "max-w-40")} />
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
                    onChange={(e) => { const next = [...grp.rows]; next[i] = { ...r, from: e.target.value }; grp.set(next); setDirty(true); }}
                    inputMode="numeric"
                    placeholder="dari"
                    className={cn(inputCls, "w-24")}
                    aria-label={`${grp.title} baris ${i + 1} dari`}
                  />
                  <span className="text-xs font-bold text-muted-foreground">→ +</span>
                  <Input
                    value={r.add}
                    onChange={(e) => { const next = [...grp.rows]; next[i] = { ...r, add: e.target.value }; grp.set(next); setDirty(true); }}
                    inputMode="numeric"
                    placeholder="Rp"
                    className={cn(inputCls, "flex-1")}
                    aria-label={`${grp.title} baris ${i + 1} tambahan`}
                  />
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => { grp.set([...grp.rows, { from: "", add: "" }]); setDirty(true); }} className="mt-1.5 text-xs font-bold text-unp">
              + Tambah baris
            </Button>
          </div>
        ))}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Jam malam 22:30 (Rp)</Label>
            <Input value={night2230} onChange={(e) => { setNight2230(e.target.value); setDirty(true); }} inputMode="numeric" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Jam malam 23:00 (Rp)</Label>
            <Input value={night2300} onChange={(e) => { setNight2300(e.target.value); setDirty(true); }} inputMode="numeric" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Jam malam 00:00–05:00 (Rp)</Label>
            <Input value={night0000} onChange={(e) => { setNight0000(e.target.value); setDirty(true); }} inputMode="numeric" className={inputCls} />
          </div>
        </div>
      </section>

      {/* 5) Uji hitung */}
      <section className="rounded-3xl border-2 border-gold/50 bg-gold-soft/40 p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-unp-deep">5 · Uji hitung (angka form saat ini)</h2>
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
    </div>
  );
}
