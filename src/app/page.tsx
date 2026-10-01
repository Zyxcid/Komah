"use client";

import { AuthProvider } from "@/components/komah/lib";
import AppShell from "@/components/komah/shell";

export default function Page() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
