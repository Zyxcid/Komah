export type Role = "USER" | "DRIVER" | "ADMIN";
export type OrderType = "OJEK" | "BARANG" | "MAKANAN";
export type OrderStatus = "MENCARI" | "DIKONFIRMASI" | "BERJALAN" | "SELESAI" | "DIBATALKAN";

/** Rincian tarif resmi — disimpan server di Order.fareBreakdown. */
export interface FareBreakdownT {
  distanceKm: number;
  base: number;
  rain: number;
  foodRain: number;
  portions: number;
  places: number;
  waiting: number;
  night: number;
  total: number;
}

export interface LocationT {
  id: string;
  name: string;
  category: "KAMPUS" | "KOS" | "PUBLIK";
  isPopular: boolean;
  lat: number | null;
  lng: number | null;
}

export interface DriverPublic {
  id: string;
  name: string;
  nim: string | null;
  avatarUrl: string | null;
  vehiclePlate: string | null;
  vehicleType: string | null;
  isOnline: boolean;
  rating: number;
  ratingCount: number;
  totalTrips: number;
}

export interface PersonOnOrder {
  id: string;
  name: string;
  phone: string;
  nim?: string | null;
  avatarUrl: string | null;
  rating?: number;
  ratingCount?: number;
  vehiclePlate?: string | null;
  vehicleType?: string | null;
  isOnline?: boolean;
}

export interface OrderT {
  id: string;
  code: string;
  type: OrderType;
  pickupLocation: LocationT;
  destLocation: LocationT;
  pickupDetail: string | null;
  destDetail: string | null;
  itemNote: string | null;
  passengerNote: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  destLat: number | null;
  destLng: number | null;
  driverLat: number | null;
  driverLng: number | null;
  driverPosAt: string | null;
  // ==== Tarif resmi (jarak tempuh + surcharge) ====
  /** Jarak rute yang dipakai menghitung tarif (meter); null = tanpa koordinat. */
  distanceMeters: number | null;
  /** Pelanggan tetap minta jalan saat hujan. */
  rain: boolean;
  /** MAKANAN: jumlah porsi/bungkus. */
  portions: number | null;
  /** MAKANAN: jumlah tempat pembelian. */
  places: number | null;
  /** MAKANAN: lama driver menunggu (menit) — diisi saat pesanan selesai. */
  waitingMinutes: number | null;
  /** Rincian tarif resmi (komponen tarif saat pesanan dibuat/diselesaikan). */
  fareBreakdown: FareBreakdownT | null;
  fare: number;
  paymentMethod: string;
  status: OrderStatus;
  rating: number | null;
  review: string | null;
  driver: PersonOnOrder | null;
  user: PersonOnOrder | null;
  createdAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface MeT {
  id: string;
  name: string;
  email: string;
  phone: string;
  nim: string | null;
  role: Role;
  avatarUrl: string | null;
  vehiclePlate: string | null;
  vehicleType: string | null;
  ktmUrl: string | null;
  verifyStatus: "PENDING" | "VERIFIED" | "REJECTED" | null;
  /** Mode pembuka aplikasi: PENUMPANG | DRIVER. */
  appMode: "PENUMPANG" | "DRIVER";
  /** true bila driver sedang mengantar (pesanan DIKONFIRMASI/BERJALAN) — kunci pindah mode. */
  activeDrive: boolean;
  isOnline: boolean;
  rating: number;
  ratingCount: number;
  totalTrips: number;
  totalEarnings: number;
}

export interface AddressT {
  id: string;
  label: string;
  detail: string | null;
  location: LocationT;
}

export interface DriverDashboardT {
  incoming: OrderT[];
  active: OrderT[];
  stats: {
    todayEarnings: number;
    todayTrips: number;
    totalTrips: number;
    totalEarnings: number;
    rating: number;
    ratingCount: number;
    isOnline: boolean;
    verifyStatus: "PENDING" | "VERIFIED" | "REJECTED" | null;
  };
}
