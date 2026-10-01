// Logika tarif KOMAH — mengikuti skema riset pasar:
// tarif dasar Rp6.000 (dalam kampus / kos terdekat), bertambah sesuai jarak zona.
// Tarif dasar dapat diatur admin (Setting "baseFare"); fallback Rp6.000.
export const BASE_FARE = 6000;

export function calcFare(
  pickup: { category: string; fare: number },
  dest: { category: string; fare: number },
  baseFare: number = BASE_FARE
): number {
  // Dalam kampus -> dalam kampus: tarif dasar
  if (pickup.category === "KAMPUS" && dest.category === "KAMPUS") {
    return baseFare;
  }
  // Kampus <-> luar kampus: pakai tarif lokasi luar kampus
  if (pickup.category === "KAMPUS") return dest.fare;
  if (dest.category === "KAMPUS") return pickup.fare;
  // Luar kampus <-> luar kampus: tarif tertinggi + biaya tambahan
  return Math.max(pickup.fare, dest.fare) + 1000;
}

export function fareBreakdown(
  pickup: { category: string; fare: number; name: string },
  dest: { category: string; fare: number; name: string },
  baseFare: number = BASE_FARE
) {
  const total = calcFare(pickup, dest, baseFare);
  return {
    base: baseFare,
    distance: total - baseFare,
    total,
  };
}
