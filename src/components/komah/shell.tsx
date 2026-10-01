"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bike,
  ClipboardList,
  History,
  LogOut,
  MapPin,
  ShieldCheck,
  User,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { navigate, useAuth, useRoute, type Route } from "./lib";
import { LogoKOMAH, UserAvatar } from "./bits";
import { Welcome } from "./welcome";
import { LoginView, RegisterView } from "./auth-view";
import { HomeView } from "./home-view";
import { OrderFlowView } from "./order-flow";
import { OrderDetailView } from "./order-detail";
import { HistoryView } from "./history-view";
import { DriverDashboardView } from "./driver-dashboard";
import { AdminView } from "./admin-view";
import { ProfileView } from "./profile-view";

const AUTH_ROUTES = new Set(["home", "order", "order-detail", "history", "driver-mode", "admin", "profile"]);

function afterLoginPath(role: string) {
  if (role === "ADMIN") return "/verifikasi";
  if (role === "DRIVER") return "/mode-driver";
  return "/beranda";
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
    case "admin":
      return <AdminView />;
    case "profile":
      return <ProfileView />;
    default:
      return <Welcome />;
  }
}

function AppFrame({ route, children }: { route: Route; children: React.ReactNode }) {
  const { me, logout } = useAuth();
  const role = me?.role || "USER";

  // Navigasi inti disederhanakan: aplikasi = alat, bukan etalase.
  const tabs =
    role === "ADMIN"
      ? [
          { name: "admin", path: "/verifikasi", label: "Verifikasi", icon: ClipboardList },
          { name: "profile", path: "/profil", label: "Profil", icon: User },
        ]
      : role === "DRIVER"
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Navbar atas (desktop) */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button onClick={() => navigate(afterLoginPath(role))} aria-label="Beranda KOMAH" className="active:scale-95 transition-transform">
            <LogoKOMAH />
          </button>

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
                <DropdownMenuItem onClick={() => navigate("/mode-driver")} className="gap-2.5 font-semibold">
                  <Bike size={15} /> Mode Driver
                </DropdownMenuItem>
              )}
              {me?.role === "ADMIN" && (
                <DropdownMenuItem onClick={() => navigate("/verifikasi")} className="gap-2.5 font-semibold">
                  <ShieldCheck size={15} /> Panel Verifikasi
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

  // Guard akses & pengalihan
  useEffect(() => {
    if (loading) return;
    if (AUTH_ROUTES.has(route.name) && !me) {
      navigate("/masuk", true);
      return;
    }
    if (me) {
      if (route.name === "landing" || route.name === "login" || route.name === "register") {
        navigate(afterLoginPath(me.role), true);
        return;
      }
      if (route.name === "driver-mode" && me.role !== "DRIVER") {
        navigate(me.role === "ADMIN" ? "/verifikasi" : "/beranda", true);
        return;
      }
      if (route.name === "admin" && me.role !== "ADMIN") {
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
