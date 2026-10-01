"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Bike,
  ClipboardList,
  History,
  Home,
  LogOut,
  MapPin,
  MapPinned,
  User,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiCall, effectiveMode, homeRouteName, modeHome, navigate, useAuth, useRoute, type Route } from "./lib";
import { TYPE_META } from "./lib";
import { LogoKOMAH, UserAvatar } from "./bits";
import { Welcome } from "./welcome";
import { LoginView, RegisterView } from "./auth-view";
import { HomeView } from "./home-view";
import { OrderFlowView } from "./order-flow";
import { OrderDetailView } from "./order-detail";
import { HistoryView } from "./history-view";
import { DriverDashboardView } from "./driver-dashboard";
import { AdminView } from "./admin-view";
import { AdminHomeView } from "./admin-home";
import { AdminLocationsView } from "./admin-locations";
import { ProfileView } from "./profile-view";

const AUTH_ROUTES = new Set([
  "home",
  "order",
  "order-detail",
  "history",
  "driver-mode",
  "admin-home",
  "admin",
  "admin-locations",
  "profile",
]);

function routeTitle(route: Route): string {
  switch (route.name) {
    case "home":
      return "Beranda";
    case "order":
      return route.type ? `Pesan ${TYPE_META[route.type].label}` : "Pesan Layanan";
    case "order-detail":
      return "Detail Pesanan";
    case "history":
      return "Riwayat Pesanan";
    case "driver-mode":
      return "Mode Driver";
    case "admin-home":
      return "Beranda Admin";
    case "admin":
      return "Verifikasi Driver";
    case "admin-locations":
      return "Kelola Lokasi";
    case "profile":
      return "Profil Saya";
    default:
      return "KOMAH";
  }
}

function ViewFor(route: Route) {
  switch (route.name) {
    case "login":
      return <LoginView />;
    case "home":
      return <HomeView />;
    case "order":
      return <OrderFlowView initialType={route.type} />;
    case "order-detail":
      return <OrderDetailView code={route.code} />;
    case "history":
      return <HistoryView />;
    case "driver-mode":
      return <DriverDashboardView />;
    case "admin-home":
      return <AdminHomeView />;
    case "admin":
      return <AdminView />;
    case "admin-locations":
      return <AdminLocationsView />;
    case "profile":
      return <ProfileView />;
    default:
      return <Welcome />;
  }
}

function AppFrame({ route, children }: { route: Route; children: React.ReactNode }) {
  const { toast } = useToast();
  const { me, activeOrder, refresh, logout } = useAuth();
  const role = me?.role || "USER";

  // Tab & pintasan mengikuti MODE aktif, bukan sekadar role — driver yang
  // memilih mode penumpang menavigasi layaknya penumpang (dan sebaliknya).
  const mode = effectiveMode(me);

  // Navigasi inti disederhanakan: aplikasi = alat, bukan etalase.
  // Tab driver juga tetap tampil saat driver mode-penumpang sedang membuka
  // dashboard (mis. baru selesai mengantar) — tab mengikuti layar aktif.
  const onDriverScreen = role === "DRIVER" && (mode === "DRIVER" || route.name === "driver-mode");
  const tabs =
    role === "ADMIN"
      ? [
          { name: "admin-home", path: "/admin", label: "Beranda", icon: Home },
          { name: "admin", path: "/verifikasi", label: "Verifikasi", icon: ClipboardList },
          { name: "admin-locations", path: "/kelola-lokasi", label: "Lokasi", icon: MapPinned },
          { name: "profile", path: "/profil", label: "Profil", icon: User },
        ]
      : onDriverScreen
        ? [
            { name: "driver-mode", path: "/mode-driver", label: "Dashboard", icon: Bike },
            { name: "history", path: "/riwayat", label: "Riwayat", icon: History },
            { name: "profile", path: "/profil", label: "Profil", icon: User },
          ]
        : [
            { name: "home", path: "/beranda", label: "Beranda", icon: MapPin },
            { name: "history", path: "/riwayat", label: "Riwayat", icon: History },
            { name: "profile", path: "/profil", label: "Profil", icon: User },
          ];

  const homePath = modeHome(me);
  const isHome = route.name === homeRouteName(me);
  const title = routeTitle(route);

  // Pindah mode (disimpan di profil) — halaman pembuka aplikasi ikut berubah.
  async function switchMode(target: "PENUMPANG" | "DRIVER") {
    // Guard lokal dulu agar responsnya instan (server tetap menjaga kedua arah).
    if (target === "PENUMPANG" && me?.activeDrive) {
      toast({ title: "Tidak bisa pindah mode", description: "Selesaikan pesanan yang sedang Anda antar dulu.", variant: "destructive" });
      return;
    }
    if (target === "DRIVER" && activeOrder) {
      toast({ title: "Tidak bisa pindah mode", description: "Selesaikan perjalanan Anda sebagai penumpang dulu.", variant: "destructive" });
      return;
    }
    const { ok, data } = await apiCall("/api/profile", "PATCH", { appMode: target });
    if (!ok) {
      toast({ title: "Gagal pindah mode", description: data.error, variant: "destructive" });
      return;
    }
    await refresh();
    navigate(target === "DRIVER" ? "/mode-driver" : "/beranda");
    toast({
      title: target === "DRIVER" ? "Beralih ke Mode Driver" : "Beralih ke Mode Penumpang",
      description: "Aplikasi juga akan membuka mode ini saat kamu masuk nanti.",
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Navbar atas (desktop) */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          {isHome ? (
            <button onClick={() => navigate(homePath)} aria-label="Beranda KOMAH" className="active:scale-95 transition-transform">
              <LogoKOMAH />
            </button>
          ) : (
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                onClick={() => navigate(homePath)}
                aria-label={`Kembali ke ${mode === "DRIVER" && role === "DRIVER" ? "dashboard driver" : "beranda"}`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card text-foreground transition-colors hover:border-unp hover:text-unp active:scale-95"
              >
                <ArrowLeft size={19} />
              </button>
              <h1 className="truncate text-base font-extrabold sm:text-lg">{title}</h1>
            </div>
          )}

          {/* Navigasi lewat ikon user (dropdown) & tab bar bawah — tanpa navbar ganda */}

          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full outline-none ring-unp/40 focus-visible:ring-2 active:scale-95 transition-transform">
              <UserAvatar name={me?.name || "?"} url={me?.avatarUrl} size={40} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <p className="font-extrabold">{me?.name}</p>
                <p className="text-xs font-normal text-muted-foreground">{me?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profil")} className="gap-2.5 font-semibold">
                <User size={15} /> Profil Saya
              </DropdownMenuItem>
              {me?.role === "DRIVER" && (
                <DropdownMenuItem onClick={() => switchMode(mode === "DRIVER" ? "PENUMPANG" : "DRIVER")} className="gap-2.5 font-semibold">
                  {mode === "DRIVER" ? <MapPin size={15} /> : <Bike size={15} />}
                  {mode === "DRIVER" ? "Mode Penumpang" : "Mode Driver"}
                </DropdownMenuItem>
              )}
              {me?.role !== "ADMIN" && (
                <DropdownMenuItem onClick={() => navigate("/riwayat")} className="gap-2.5 font-semibold">
                  <History size={15} /> Riwayat Pesanan
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="gap-2.5 font-semibold text-red-600 focus:text-red-600">
                <LogOut size={15} /> Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Konten */}
      <main className="flex-1 pb-20 md:pb-8">{children}</main>

      {/* Tab bar bawah (mobile) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg md:hidden"
        aria-label="Navigasi bawah"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid h-16 max-w-md" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => (
            <button
              key={t.name}
              onClick={() => navigate(t.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 pb-1 pt-1.5 transition-colors",
                route.name === t.name ? "text-unp" : "text-muted-foreground"
              )}
              aria-current={route.name === t.name ? "page" : undefined}
            >
              <t.icon size={21} strokeWidth={route.name === t.name ? 2.5 : 2} />
              <span className="text-[10px] font-bold">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function AppShell() {
  const { route, query } = useRoute();
  const { me, loading } = useAuth();

  // Guard akses & pengalihan — halaman pembuka mengikuti mode tersimpan.
  useEffect(() => {
    if (loading) return;
    if (AUTH_ROUTES.has(route.name) && !me) {
      navigate("/masuk", true);
      return;
    }
    if (me) {
      if (route.name === "landing" || route.name === "login" || route.name === "register") {
        navigate(modeHome(me), true);
        return;
      }
      if (route.name === "driver-mode" && me.role !== "DRIVER") {
        navigate(me.role === "ADMIN" ? "/admin" : "/beranda", true);
        return;
      }
      if ((route.name === "admin-home" || route.name === "admin" || route.name === "admin-locations") && me.role !== "ADMIN") {
        navigate("/beranda", true);
      }
    }
  }, [route, me, loading]);

  const inApp = AUTH_ROUTES.has(route.name);
  const key = `${route.name}-${route.name === "order-detail" ? route.code : ""}`;

  // Daftar dengan role awal (dari tautan "Daftar jadi driver")
  let view: React.ReactNode;
  if (route.name === "register") {
    const roleParam = query.get("role") === "DRIVER" ? "DRIVER" : undefined;
    view = <RegisterView initialRole={roleParam} />;
  } else {
    view = ViewFor(route);
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={cn(inApp ? "flex min-h-screen flex-col" : "")}
      >
        {inApp ? (
          <AppFrame route={route}>
            <div className="flex-1">{view}</div>
          </AppFrame>
        ) : (
          view
        )}
      </motion.div>
    </AnimatePresence>
  );
}
