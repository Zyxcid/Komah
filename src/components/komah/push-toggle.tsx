"use client";

// Toggle notifikasi push di halaman Profil: langganan Web Push agar pengguna
// tetap tahu update pesanan walau aplikasi KOMAH ditutup. Driver juga punya
// toggle khusus di dashboard (lengkap dengan bunyi pesanan baru); keduanya
// mengelola langganan yang sama (kunci localStorage yang sama).

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiCall } from "./lib";
import { ensurePushSubscription, NOTIF_KEY, removePushSubscription } from "./push";

// Sama dengan dashboard driver — satu preferensi per perangkat.

export function PushToggleCard() {
  const { toast } = useToast();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [iosPwaHint, setIosPwaHint] = useState(false);

  // Sinkronkan toggle dengan keadaan nyata browser (izin + langganan tersisa).
  useEffect(() => {
    let alive = true;
    (async () => {
      // iPhone hanya bisa push bila KOMAH dipasang ke layar utama (PWA).
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (alive) setIosPwaHint(isIOS && !standalone);

      if (localStorage.getItem(NOTIF_KEY) !== "1") return;
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const cfg = await fetch("/api/push/config")
        .then((r) => r.json())
        .catch(() => ({ publicKey: null as string | null }));
      if (!alive || !cfg?.publicKey) return;
      const sub = await ensurePushSubscription(cfg.publicKey);
      if (!alive || !sub) return;
      setOn(true);
      // Langganan bisa hilang (mis. cache dibersihkan) — pastikan tercatat di server.
      const j = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth }),
      }).catch(() => {});
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      if (next) {
        if (typeof Notification === "undefined") {
          toast({ title: "Browser ini tidak mendukung notifikasi", variant: "destructive" });
          return;
        }
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          toast({
            title: "Izin notifikasi belum diberikan",
            description: "Klik ikon kunci di address bar → Izinkan notifikasi, lalu nyalakan lagi tombol ini.",
            variant: "destructive",
          });
          return;
        }
        const cfg = await fetch("/api/push/config")
          .then((r) => r.json())
          .catch(() => ({ publicKey: null as string | null }));
        if (!cfg?.publicKey) {
          toast({
            title: "Notifikasi belum dikonfigurasi",
            description: "Server membutuhkan VAPID_PUBLIC_KEY di .env (lihat DEPLOY.md).",
            variant: "destructive",
          });
          return;
        }
        const sub = await ensurePushSubscription(cfg.publicKey);
        if (!sub) {
          toast({
            title: "Perangkat ini belum bisa menerima push",
            description: "Muat ulang halaman lalu coba lagi, atau pakai jendela biasa (bukan incognito).",
            variant: "destructive",
          });
          return;
        }
        const j = sub.toJSON();
        const { ok, data: res } = await apiCall("/api/push/subscribe", "POST", {
          endpoint: j.endpoint,
          p256dh: j.keys?.p256dh,
          auth: j.keys?.auth,
        });
        if (!ok) {
          toast({ title: "Gagal menyimpan langganan", description: res.error, variant: "destructive" });
          return;
        }
        localStorage.setItem(NOTIF_KEY, "1");
        setOn(true);
        toast({
          title: "Notifikasi aktif",
          description: "Kamu akan dikabari walau aplikasi KOMAH sedang ditutup.",
        });
      } else {
        const endpoint = await removePushSubscription();
        if (endpoint) await apiCall("/api/push/unsubscribe", "POST", { endpoint });
        localStorage.removeItem(NOTIF_KEY);
        setOn(false);
        toast({ title: "Notifikasi dimatikan" });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <Bell size={18} className="mt-0.5 shrink-0 text-unp" />
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">Notifikasi Pesanan</h2>
          {iosPwaHint && (
            <p className="mt-1 text-[11px] leading-relaxed text-gold-dark">
              iPhone: pasang KOMAH ke layar utama (Bagikan → Tambah ke Layar Utama) agar notifikasi berfungsi.
            </p>
          )}
        </div>
      </div>
      <Switch checked={on} onCheckedChange={toggle} disabled={busy} className="data-[state=checked]:bg-gold" />
    </div>
  );
}
