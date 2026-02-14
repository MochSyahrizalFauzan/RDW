import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistem Penempatan Barang",
  description: "PT. Radian Delta Wijaya",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable}`}>
          <Toaster richColors position="top-right" />
        {children}
      </body>
    </html>
  );
}

