"use client";

// Error boundary global: menangkap error render React di SPA agar pengguna
// melihat halaman pemulihan yang ramah (muat ulang / ke beranda) alih-alih
// layar putih kosong.

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Error asli tetap tercatat di console untuk debugging.
    console.error("UI error ditangkap error boundary:", error);
  }

  private reload = () => {
    window.location.reload();
  };

  private goHome = () => {
    window.location.hash = "#/";
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold/40 bg-gold-soft">
          <AlertTriangle size={28} className="text-unp" />
        </div>
        <h1 className="mt-5 text-xl font-extrabold text-foreground">
          Ada kendala saat menampilkan halaman
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Maaf, terjadi kesalahan tak terduga di aplikasi KOMAH. Datamu aman —
          coba muat ulang halaman, atau kembali ke beranda.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={this.reload}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-unp-deep transition-colors hover:bg-gold-dark active:scale-95"
          >
            <RefreshCw size={16} /> Muat Ulang
          </button>
          <button
            onClick={this.goHome}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-bold text-foreground transition-colors hover:border-unp/50 hover:text-unp active:scale-95"
          >
            <Home size={16} /> Ke Beranda
          </button>
        </div>
      </div>
    );
  }
}
