"use client";

import { useEffect } from "react";

/** Mendaftarkan service worker (PWA) setelah aplikasi siap.
 *  Gagal silent — PWA bersifat progresif, bukan syarat jalan. */
export function PwaRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const t = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Diabaikan: lingkungan tanpa SW (mis. http non-localhost) tetap berjalan normal.
      });
    }, 1200);
    return () => clearTimeout(t);
  }, []);
  return null;
}
