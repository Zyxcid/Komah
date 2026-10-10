"use client";

// Helper Web Push sisi klien (browser driver): konversi kunci VAPID,
// langganan/berhenti langganan, dan bunyi pesanan baru (Web Audio).

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Pastikan service worker terpasang dan push subscription aktif.
// Mengembalikan PushSubscription, atau null bila browser tidak mendukung /
// sedang dalam mode yang menyembunyikan push (mis. incognito).
export async function ensurePushSubscription(vapidPublicKey: string): Promise<PushSubscription | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const reg = await navigator.serviceWorker.register("/sw.js").catch(() => null);
  if (!reg?.pushManager) return null;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  try {
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
  } catch {
    return null;
  }
}

// Berhenti berlangganan push di perangkat ini; mengembalikan endpoint lama
// (untuk dihapus dari server), atau null bila tidak ada langganan.
export async function removePushSubscription(): Promise<string | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return null;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    return endpoint;
  } catch {
    return null;
  }
}

// Bunyi "ding-dong" dua nada lewat Web Audio (tanpa file audio).
// Aman dipanggil di mana saja — semua kegagalan ditelan.
export function playNewOrderChime(): void {
  try {
    const Ctx =
      typeof window !== "undefined"
        ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t0 = ctx.currentTime;
    const notes: Array<[number, number]> = [
      [880, 0],
      [1174.7, 0.18],
    ];
    for (const [freq, delay] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + delay);
      gain.gain.exponentialRampToValueAtTime(0.22, t0 + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + delay);
      osc.stop(t0 + delay + 0.22);
    }
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch {
    // Bunyi gagal (mis. kebijakan autoplay) — tidak masalah.
  }
}
