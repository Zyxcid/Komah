"use client";

import { AuthProvider } from "@/components/komah/lib";
import AppShell from "@/components/komah/shell";
import { AppErrorBoundary } from "@/components/komah/error-boundary";

export default function Page() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </AppErrorBoundary>
  );
}
