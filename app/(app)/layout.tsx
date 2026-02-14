"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Toaster } from "sonner";

// Use relative path for API calls

type MeResponse = {
  user?: {
    user_id: number;
    full_name: string;
    username: string;
    role: string;
  };
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const res = await fetch(`/api/auth/me`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (res.status === 401) {
          localStorage.clear();
          router.replace("/login");
          return;
        }

        if (!res.ok) {
          router.replace("/login");
          return;
        }

        const json: MeResponse = await res.json().catch(() => ({} as any));
        const u = json?.user;

        if (!u) {
          router.replace("/login");
          return;
        }

        localStorage.setItem("role", String(u.role || "admin"));
        localStorage.setItem("user_id", String(u.user_id || ""));
        localStorage.setItem("full_name", String(u.full_name || ""));
        localStorage.setItem("username", String(u.username || ""));
        localStorage.setItem("user", JSON.stringify(u));

        if (mounted) setReady(true);
      } catch {
        router.replace("/login");
      }
    }

    checkSession();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Memeriksa sesi login...
      </div>
    );
  }

  return (
    <>
      {/* ===== ROOT APP LAYOUT ===== */}
      <div className="appRoot">
        <aside className="appSidebar">
          <Sidebar />
        </aside>

        <div className="appMain">
          <header className="appTopbar">
            <Topbar />
          </header>

          <main className="appContent">{children}</main>
        </div>
      </div>

      {/* ===== GLOBAL TOASTER (WAJIB SATU KALI) ===== */}
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={3000}
      />
    </>
  );
}
