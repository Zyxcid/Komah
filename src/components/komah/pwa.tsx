"use client";

// PWA — daftarkan service worker (cache shell agar tetap terbuka saat koneksi
// lambat). Aman dipanggil dua kali; hanya berjalan di produksi browser.

import { useEffect } from "react";

export function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW gagal terpasang (mis. mode incognito) — aplikasi tetap jalan normal.
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
