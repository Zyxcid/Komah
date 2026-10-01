export type Role = "USER" | "DRIVER" | "ADMIN";
export type OrderType = "OJEK" | "BARANG" | "MAKANAN";
export type OrderStatus = "MENCARI" | "DIKONFIRMASI" | "BERJALAN" | "SELESAI" | "DIBATALKAN";

export interface LocationT {
  id: string;
  name: string;
  category: "KAMPUS" | "KOS" | "PUBLIK";
  fare: number;
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
  verifyStatus: "PENDING" | "VERIFIED" | "REJECTED" | null;
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
