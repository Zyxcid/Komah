import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { calcOfficialFare, haversineKm, ROAD_FACTOR } from "../src/lib/fare";

const db = new PrismaClient();

const KTM_DEMO = "/uploads/ktm-demo.svg";

async function main() {
  console.log("Menghapus data lama...");
  // Hapus laporan dulu — menunya memakai FK ke Order & User.
  await db.report.deleteMany();
  await db.order.deleteMany();
  await db.savedAddress.deleteMany();
  await db.user.deleteMany();
  await db.location.deleteMany();
  await db.setting.deleteMany();

  console.log("Menanam lokasi UNP...");
  // Koordinat approx di sekitar kampus UNP Air Tawar, Padang (untuk demo peta — bisa disesuaikan).
  // Tarif tidak ditanam per lokasi: dihitung otomatis dari jarak rute (daftar harga resmi).
  const locationsData = [
    // Dalam kampus
    { name: "Gerbang Utama UNP", category: "KAMPUS", isPopular: true, lat: -0.9042, lng: 100.3462 },
    { name: "Rektorat UNP", category: "KAMPUS", isPopular: false, lat: -0.9022, lng: 100.3495 },
    { name: "Fakultas Teknik (FT)", category: "KAMPUS", isPopular: true, lat: -0.8989, lng: 100.3521 },
    { name: "Fakultas Ekonomi (FE)", category: "KAMPUS", isPopular: true, lat: -0.9011, lng: 100.3512 },
    { name: "FMIPA", category: "KAMPUS", isPopular: false, lat: -0.9002, lng: 100.3502 },
    { name: "FIP", category: "KAMPUS", isPopular: false, lat: -0.8993, lng: 100.3487 },
    { name: "FIS (Ilmu Sosial)", category: "KAMPUS", isPopular: false, lat: -0.9028, lng: 100.3503 },
    { name: "FIK (Ilmu Keolahragaan)", category: "KAMPUS", isPopular: false, lat: -0.9038, lng: 100.3518 },
    { name: "GOR UNP", category: "KAMPUS", isPopular: false, lat: -0.8981, lng: 100.3535 },
    { name: "Masjid UNP", category: "KAMPUS", isPopular: false, lat: -0.9015, lng: 100.3498 },
    { name: "Perpustakaan Pusat", category: "KAMPUS", isPopular: false, lat: -0.9008, lng: 100.3505 },
    { name: "Kantin Pusat UNP", category: "KAMPUS", isPopular: false, lat: -0.8998, lng: 100.3515 },
    // Kos & tempat tinggal mahasiswa
    { name: "Jl. Parkit (Area Kos)", category: "KOS", isPopular: true, lat: -0.8963, lng: 100.3541 },
    { name: "Jl. Beringin (Area Kos)", category: "KOS", isPopular: false, lat: -0.9055, lng: 100.3522 },
    { name: "Sungai Sapih", category: "KOS", isPopular: false, lat: -0.9090, lng: 100.3561 },
    { name: "Kurao", category: "KOS", isPopular: true, lat: -0.8912, lng: 100.3533 },
    { name: "Simpang Haru", category: "KOS", isPopular: false, lat: -0.9142, lng: 100.3623 },
    { name: "Balai Gadang", category: "KOS", isPopular: false, lat: -0.8859, lng: 100.3365 },
    // Titik publik sekitar kampus
    { name: "Pasar Ambacang", category: "PUBLIK", isPopular: false, lat: -0.9185, lng: 100.3544 },
    { name: "Pertokoan Jl. Prof. Hamka", category: "PUBLIK", isPopular: false, lat: -0.9031, lng: 100.3438 },
  ];
  const locations: Record<string, { id: string; name: string; category: string; lat: number | null; lng: number | null }> = {};
  for (const l of locationsData) {
    const created = await db.location.create({ data: l });
    locations[l.name] = created;
  }

  console.log("Menanam akun demo...");
  const pw = hashPassword("komah123");

  const admin = await db.user.create({
    data: {
      name: "Admin KOMAH",
      email: "admin@komah.id",
      passwordHash: pw,
      phone: "081200000001",
      nim: "197001011990031001",
      role: "ADMIN",
    },
  });

  const rani = await db.user.create({
    data: {
      name: "Rani Oktaviani",
      email: "penumpang@komah.id",
      passwordHash: pw,
      phone: "081234567890",
      nim: "2210312005",
      role: "USER",
    },
  });

  const indra = await db.user.create({
    data: {
      name: "Indra Saputra",
      email: "indra@komah.id",
      passwordHash: pw,
      phone: "081298765432",
      nim: "2210147011",
      role: "USER",
    },
  });

  const mila = await db.user.create({
    data: {
      name: "Mila Rahma",
      email: "mila@komah.id",
      passwordHash: pw,
      phone: "081377788899",
      nim: "2310511022",
      role: "USER",
    },
  });

  console.log("Menanam driver terverifikasi...");
  const driversData = [
    { name: "Ahmad Fauzan", email: "driver@komah.id", nim: "2110210078", phone: "081211112222", plate: "BA 4521 KX", vehicle: "Honda Beat Hitam", online: true, rating: 4.9, ratingCount: 47, trips: 52, earnings: 268000 },
    { name: "Rizki Pratama", email: "rizki@komah.id", nim: "2110114033", phone: "081233334444", plate: "BA 1876 JD", vehicle: "Honda Vario Merah", online: true, rating: 4.8, ratingCount: 35, trips: 39, earnings: 201000 },
    { name: "Dewi Anggraini", email: "dewi@komah.id", nim: "2210314019", phone: "081255556666", plate: "BA 3099 UM", vehicle: "Yamaha Mio Biru", online: true, rating: 5.0, ratingCount: 21, trips: 22, earnings: 112000 },
    { name: "Bayu Setiawan", email: "bayu@komah.id", nim: "2010512087", phone: "081277778888", plate: "BA 5432 BR", vehicle: "Honda Scoopy Putih", online: true, rating: 4.7, ratingCount: 28, trips: 31, earnings: 158000 },
    { name: "Fajar Ramadhan", email: "fajar@komah.id", nim: "2210241004", phone: "081299990000", plate: "BA 7788 LP", vehicle: "Yamaha Nmax Hitam", online: false, rating: 4.8, ratingCount: 19, trips: 20, earnings: 102000 },
    { name: "Putri Andini", email: "putri@komah.id", nim: "2310117056", phone: "082111112222", plate: "BA 1250 VE", vehicle: "Honda Genio Abu", online: false, rating: 4.9, ratingCount: 12, trips: 13, earnings: 66000 },
  ];
  const drivers: Record<string, string> = {};
  for (const d of driversData) {
    const created = await db.user.create({
      data: {
        name: d.name,
        email: d.email,
        passwordHash: pw,
        phone: d.phone,
        nim: d.nim,
        role: "DRIVER",
        // Driver demo membuka aplikasi langsung di dashboard.
        appMode: "DRIVER",
        vehiclePlate: d.plate,
        vehicleType: d.vehicle,
        verifyStatus: "VERIFIED",
        ktmUrl: KTM_DEMO,
        isOnline: d.online,
        rating: d.rating,
        ratingCount: d.ratingCount,
        totalTrips: d.trips,
        totalEarnings: d.earnings,
      },
    });
    drivers[d.name] = created.id;
  }

  console.log("Menanam driver menunggu verifikasi (untuk demo admin)...");
  await db.user.create({
    data: {
      name: "Yoga Pratama",
      email: "yoga@komah.id",
      passwordHash: pw,
      phone: "082133335555",
      nim: "2310245078",
      role: "DRIVER",
      appMode: "DRIVER",
      vehiclePlate: "BA 6677 QW",
      vehicleType: "Honda Beat Merah",
      verifyStatus: "PENDING",
      ktmUrl: KTM_DEMO,
    },
  });

  console.log("Menanam alamat tersimpan...");
  await db.savedAddress.create({
    data: {
      userId: rani.id,
      label: "Kos",
      locationId: locations["Jl. Parkit (Area Kos)"].id,
      detail: "Jl. Parkit 4, kos hijau lantai 2",
    },
  });
  await db.savedAddress.create({
    data: {
      userId: rani.id,
      label: "Fakultas",
      locationId: locations["Fakultas Teknik (FT)"].id,
      detail: "Ruang RSG FT",
    },
  });

  console.log("Menanam riwayat pesanan...");
  const now = Date.now();
  const H = 3600_000;
  const D = 24 * H;

  // Tarif demo dihitung dengan skema resmi (jarak garis lurus × faktor jalan).
  function demoFare(from: { lat: number | null; lng: number | null }, to: { lat: number | null; lng: number | null }, type: "OJEK" | "BARANG" | "MAKANAN", at: number, waitingMinutes = 0) {
    const km = from.lat != null && to.lat != null
      ? haversineKm({ lat: from.lat, lng: from.lng! }, { lat: to.lat, lng: to.lng! }) * ROAD_FACTOR
      : 0.1;
    return calcOfficialFare({ distanceKm: km, type, waitingMinutes, orderTime: new Date(at) });
  }

  const ordersData = [
    {
      code: "KMH-1001",
      user: rani, driver: drivers["Ahmad Fauzan"], type: "OJEK",
      from: "Jl. Parkit (Area Kos)", to: "Fakultas Teknik (FT)",
      fd: "Jl. Parkit 4, kos hijau", td: "Ruang RSG FT",
      status: "SELESAI", rating: 5, review: "Cepat dan ramah!",
      at: now - 3 * D, doneAt: now - 3 * D + 0.2 * H,
    },
    {
      code: "KMH-1002",
      user: indra, driver: drivers["Rizki Pratama"], type: "BARANG",
      from: "Fakultas Teknik (FT)", to: "Sungai Sapih",
      fd: "Parkiran FT", td: "Kos nasi goreng warna kuning",
      item: "Laptop & charger dalam tas", note: "Titip ke ibu kos ya bang",
      status: "SELESAI", rating: 5, review: "Barang aman sampai",
      at: now - 2 * D, doneAt: now - 2 * D + 0.3 * H,
    },
    {
      code: "KMH-1003",
      user: mila, driver: drivers["Dewi Anggraini"], type: "MAKANAN",
      from: "Kantin Pusat UNP", to: "FMIPA",
      fd: "Warung Mak Endang", td: "Lobi FMIPA",
      item: "Nasi rendang + es teh (sudah dibayar)", note: "Taro di meja security",
      portions: 2, places: 1, waiting: 8,
      status: "SELESAI", rating: 5, review: null,
      at: now - 1 * D - 2 * H, doneAt: now - 1 * D - 1.6 * H,
    },
    {
      code: "KMH-1004",
      user: rani, driver: drivers["Bayu Setiawan"], type: "OJEK",
      from: "Fakultas Ekonomi (FE)", to: "Jl. Parkit (Area Kos)",
      fd: "Gerbang FE", td: "Jl. Parkit 4",
      status: "SELESAI", rating: 4, review: "Sedikit telat, tapi oke",
      at: now - 5 * H, doneAt: now - 4.6 * H,
    },
    {
      code: "KMH-1005",
      user: indra, driver: drivers["Ahmad Fauzan"], type: "OJEK",
      from: "Kurao", to: "Gerbang Utama UNP",
      fd: "Perempatan Kurao", td: "",
      status: "SELESAI", rating: 5, review: null,
      at: now - 2 * H, doneAt: now - 1.7 * H,
    },
  ];

  for (const o of ordersData) {
    const from = locations[o.from];
    const to = locations[o.to];
    const type = o.type as "OJEK" | "BARANG" | "MAKANAN";
    const b = demoFare(from, to, type, o.at, o.waiting ?? 0);
    await db.order.create({
      data: {
        code: o.code,
        userId: o.user.id,
        driverId: o.driver,
        type: o.type,
        pickupLocationId: from.id,
        destLocationId: to.id,
        pickupLat: from.lat,
        pickupLng: from.lng,
        destLat: to.lat,
        destLng: to.lng,
        pickupDetail: o.fd,
        destDetail: o.td,
        itemNote: o.item ?? null,
        passengerNote: o.note ?? null,
        rain: false,
        portions: type === "MAKANAN" ? (o.portions ?? 1) : null,
        places: type === "MAKANAN" ? (o.places ?? 1) : null,
        waitingMinutes: type === "MAKANAN" ? (o.waiting ?? 0) : null,
        distanceMeters: Math.round(b.distanceKm * 1000),
        fareBreakdown: b as unknown as object,
        fare: b.total,
        status: o.status,
        rating: o.rating,
        review: o.review,
        createdAt: new Date(o.at),
        acceptedAt: new Date(o.at + 3 * 60_000),
        startedAt: new Date(o.at + 8 * 60_000),
        completedAt: new Date(o.doneAt),
      },
    });
    console.log(`  ${o.code}: ${o.from} → ${o.to} • ${b.distanceKm.toFixed(1)} km • Rp${b.total.toLocaleString("id-ID")}`);
  }

  console.log("Seed selesai!");
  console.log("Akun demo:");
  console.log("  Penumpang: penumpang@komah.id / komah123");
  console.log("  Driver   : driver@komah.id / komah123 (online, terverifikasi)");
  console.log("  Admin    : admin@komah.id / komah123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
