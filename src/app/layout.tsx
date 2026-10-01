import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "KOMAH — Ojek & Antar Daring Civitas UNP",
  description:
    "Layanan ojek dan pengantaran barang & makanan khusus civitas UNP. Tarif transparan mulai Rp6.000, driver mahasiswa terverifikasi KTM.",
  keywords: ["KOMAH", "UNP", "ojek kampus", "antar barang", "Padang"],
  authors: [{ name: "Tim KOMAH UNP" }],
};

export const viewport: Viewport = {
  themeColor: "#0E7A3E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${jakarta.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
