"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, MapPin, Settings, History, FileText } from "lucide-react";
import Image from "next/image";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/databarang", label: "Data Barang", icon: Package, badge: "1,247" },
  { href: "/lokasi", label: "Data Lokasi", icon: MapPin, badge: "8" },
  { href: "/riwayat", label: "Riwayat & Laporan Penempatan", icon: History },
  { href: "/setting", label: "Pengaturan", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="h-full flex flex-col">
      {/* Brand */}
      <div className="h-16 px-5 border-b flex items-center">

        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-muted">
            <Image
              src="/img/logo_rdw.png"
              alt="Logo PT. Raden Delta Wijaya"
              fill
              className="object-contain"
              priority
            />
          </div>

          <div className="leading-tight">
            <div className="font-bold">PT. Raden Delta Wijaya</div>
            <div className="text-xs text-muted-foreground">
              Penempatan Barang
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="p-4 space-y-1">
        {NAV.map((n) => {
          const active =
            pathname === n.href || (n.href === "/dashboard" && pathname === "/");
          const Icon = n.icon;

          return (
            <Link
              key={n.href}
              href={n.href}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                active ? "bg-black text-white" : "text-slate-700 hover:bg-slate-100",].join(" ")}>
              <Icon className="h-4 w-4" />
              <span className="flex-1">{n.label}</span>
              {n.badge ? (
                <span
                  className={[
                    "text-xs px-2 py-0.5 rounded-full",
                    active ? "bg-white/15 text-white" : "bg-slate-200 text-slate-700",
                  ].join(" ")}
                >
                  {n.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto p-4 border-t text-xs text-muted-foreground">
        PT.Raden Delta Wijaya - Global Survey
      </div>
    </div>
  );
}
