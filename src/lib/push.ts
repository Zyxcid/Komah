import webpush from "web-push";
import { db } from "@/lib/db";

// Pengirim Web Push sisi server (butuh VAPID_PUBLIC_KEY & VAPID_PRIVATE_KEY di .env).
// Tanpa kunci → mode pengembangan: pesan dicetak ke log server (cari [PUSH-DEV]).
// Semua pengiriman fault-tolerant: langganan kadaluarsa (404/410) otomatis dihapus,
// kegagalan satu perangkat tidak mengganggu perangkat lain maupun pesanan.

let vapidReady: boolean | null = null;

function ensureVapid(): boolean {
  if (vapidReady === null) {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    vapidReady = !!(pub && priv);
    if (vapidReady) {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@komah.id", pub!, priv!);
    }
  }
  return vapidReady;
}

/** Pesan push yang ditampilkan service worker di perangkat penerima. */
export interface PushMessage {
  title: string;
  body: string;
  /** Tag: notifikasi baru bertag sama menimpa yang lama (tidak menumpuk). */
  tag?: string;
  /** URL yang dibuka saat notifikasi diketuk (mis. "/#/beranda"). */
  url?: string;
}

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };

async function deliver(subs: SubRow[], msg: PushMessage): Promise<void> {
  if (subs.length === 0) return;
  if (!ensureVapid()) {
    console.log(`[PUSH-DEV] ${msg.title} — ${msg.body}`);
    return;
  }
  const payload = JSON.stringify(msg);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // Langganan tidak lagi valid di push service → bersihkan dari DB.
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    })
  );
}

export interface PushOrderPayload {
  code: string;
  type: string;
  pickupName: string;
  destName: string;
  fare: number;
}

// Kirim notifikasi "pesanan baru" ke semua langganan push driver yang online
// dan terverifikasi — sampai walau tab/aplikasi KOMAH sedang ditutup.
export async function pushNewOrderToDrivers(p: PushOrderPayload): Promise<void> {
  const subs = await db.pushSubscription.findMany({
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
      user: { select: { role: true, isOnline: true, verifyStatus: true } },
    },
  });
  const targets = subs.filter(
    (s) => s.user.role === "DRIVER" && s.user.isOnline && s.user.verifyStatus === "VERIFIED"
  );
  await deliver(targets, {
    title: `Pesanan baru ${p.code}`,
    body: `${p.pickupName} → ${p.destName} • Rp ${p.fare.toLocaleString("id-ID")}`,
    tag: `komah-${p.code}`,
    url: "/#/mode-driver",
  });
}

// Kirim push ke semua perangkat MILIK satu user (peran apa pun).
// Dipakai untuk: status pesanan bagi penumpang, pembatalan bagi driver,
// hasil verifikasi KTM, dan kabar driver baru bagi admin.
export async function sendPushToUser(userId: string, msg: PushMessage): Promise<void> {
  const subs = await db.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  await deliver(subs, msg);
}

// ===================== Template pesan =====================

/** Ke penumpang: pesanan diterima driver. */
export function msgOrderAccepted(o: {
  code: string;
  driverName: string;
  vehicle: string | null;
  pickupName: string;
  fare: number;
}): PushMessage {
  return {
    title: `Driver ditemukan — ${o.code}`,
    body: `${o.driverName} (${o.vehicle || "motor"}) menuju ${o.pickupName} • Rp ${o.fare.toLocaleString("id-ID")}. Buka KOMAH untuk melacak posisinya.`,
    tag: `komah-${o.code}`,
    url: "/#/beranda",
  };
}

/** Ke penumpang: perjalanan dimulai. */
export function msgOrderStarted(o: { code: string; destName: string; fare: number }): PushMessage {
  return {
    title: `Perjalanan dimulai — ${o.code}`,
    body: `Diantar ke ${o.destName} • Rp ${o.fare.toLocaleString("id-ID")} dibayar tunai di akhir.`,
    tag: `komah-${o.code}`,
    url: "/#/beranda",
  };
}

/** Ke penumpang: pesanan selesai. */
export function msgOrderCompleted(o: { code: string; fare: number }): PushMessage {
  return {
    title: `Perjalanan selesai — ${o.code}`,
    body: `Terima kasih! Rp ${o.fare.toLocaleString("id-ID")} (tunai). Beri rating drivermu di KOMAH ya.`,
    tag: `komah-${o.code}`,
    url: "/#/beranda",
  };
}

/** Ke driver terkait: pesanan dibatalkan penumpang. */
export function msgOrderCancelled(o: { code: string }): PushMessage {
  return {
    title: `Pesanan dibatalkan — ${o.code}`,
    body: "Penumpang membatalkan pesanan ini. Cek pesanan lain di dashboard ya.",
    tag: `komah-${o.code}`,
    url: "/#/mode-driver",
  };
}

/** Ke admin: ada driver baru menunggu verifikasi KTM. */
export function msgDriverRegistered(d: { name: string; vehicle: string | null }): PushMessage {
  return {
    title: "Driver baru mendaftar",
    body: `${d.name} (${d.vehicle || "-"}) menunggu verifikasi KTM.`,
    tag: "komah-driver-baru",
    url: "/#/admin",
  };
}

/** Ke driver: hasil verifikasi KTM. */
export function msgVerificationResult(d: { name: string; approved: boolean }): PushMessage {
  return d.approved
    ? {
        title: "Verifikasi disetujui!",
        body: `Selamat ${d.name}, akun driver-mu sudah aktif. Nyalakan mode Online dan mulai terima pesanan!`,
        tag: "komah-verifikasi",
        url: "/#/mode-driver",
      }
    : {
        title: "Verifikasi ditolak",
        body: `Maaf ${d.name}, pendaftaran driver-mu belum disetujui admin. Hubungi tim KOMAH untuk info lebih lanjut.`,
        tag: "komah-verifikasi",
        url: "/#/mode-driver",
      };
}
