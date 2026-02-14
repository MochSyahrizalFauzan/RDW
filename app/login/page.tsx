"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Lock,
  User,
  ShieldCheck,
  MapPin,
  Package,
  ChevronRight,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";

import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";


const API_URL = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

export default function LoginPage() {
  const router = useRouter();

  const [showPass, setShowPass] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // kalau sudah punya session, langsung masuk app
useEffect(() => {
  (async () => {
    try {
      const json = await apiGet<{ user: any }>("/api/auth/me", { silent401: true });
      const u = json?.user;
      if (u) {
        localStorage.setItem("role", String(u.role || "admin"));
        localStorage.setItem("user_id", String(u.user_id || ""));
        localStorage.setItem("full_name", String(u.full_name || ""));
        localStorage.setItem("username", String(u.username || ""));
        localStorage.setItem("user", JSON.stringify(u));
        router.replace("/dashboard");
      }
    } catch {
      // ignore
    }
  })();
}, [router]);



async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError("");

  const u = username.trim();
  if (!u || !password) {
    const msg = "Username & password wajib diisi.";
    setError(msg);
    toast.error("Validasi gagal", { description: msg });
    return;
  }

  setLoading(true);
  const t = toast.loading("Memproses login...");
  try {
const json = await apiPost<{ user: any; message?: string }>(
  "/api/auth/login",
  { username: u, password },
  { noRedirect401: true } 
);


    const user = json?.user;
    if (user) {
      localStorage.setItem("role", String(user.role || "admin"));
      localStorage.setItem("user_id", String(user.user_id || ""));
      localStorage.setItem("full_name", String(user.full_name || ""));
      localStorage.setItem("username", String(user.username || ""));
      localStorage.setItem("user", JSON.stringify(user));
    }

    toast.success("Login berhasil", {
      id: t,
      description: user?.full_name ? `Halo, ${user.full_name}` : undefined,
    });

    router.replace("/dashboard");
  } catch (err: any) {
    // pesan dari backend: "Username / password salah", "Akun nonaktif", dll
    const msg = err?.message || "Login gagal.";
    setError(msg);

    toast.error("Login gagal", { id: t, description: msg });

    // optional: kosongkan password biar user retype
    setPassword("");
  } finally {
    setLoading(false);
  }
}



  return (
    <div className="min-h-screen bg-background">
      {/* Soft global background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute -top-24 left-0 h-80 w-80 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute top-10 right-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,0,0,0.03),transparent_55%)]" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-2xl border bg-card shadow-sm md:grid-cols-2">
          {/* LEFT (desktop) */}
          <div className="relative hidden md:block">
            <Image
              src="/img/login-bg.jpg"
              alt="Warehouse Background"
              fill
              priority
              className="object-cover scale-105"
            />

            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.35))]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.35),transparent_55%)]" />

            <div
              className="absolute inset-0 opacity-[0.06]
              [background-image:
                linear-gradient(to_right,rgba(255,255,255,0.6)_1px,transparent_1px),
                linear-gradient(to_bottom,rgba(255,255,255,0.6)_1px,transparent_1px)
              ]
              [background-size:48px_48px]"
            />

            <div className="absolute inset-x-0 bottom-0 h-48 w-200 bg-gradient-to-t from-background to-transparent" />

            <div className="relative flex h-full flex-col p-10">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-white/90 shadow-sm">
                  <Image
                    src="/img/logo_rdw.png"
                    alt="Logo PT. Raden Delta Wijaya"
                    width={44}
                    height={44}
                    className="object-contain"
                    priority
                  />
                </div>

                <div className="leading-tight">
                  <div className="text-sm font-semibold text-muted">
                    PT. Raden Delta Wijaya
                  </div>
                  <div className="text-xs text-muted">Global Survey</div>
                </div>
              </div>

              <div className="mt-10">
                <h1 className="text-2xl font-bold tracking-tight text-muted">
                  Sistem Penempatan Barang
                </h1>
                <p className="mt-2 max-w-md text-sm text-muted">
                  Pengelolaan inventory, lokasi penyimpanan, dan kapasitas gudang secara
                  terpusat.
                </p>
              </div>

              <div className="mt-8 space-y-3">
                <Highlight
                  icon={<Package className="h-4 w-4" />}
                  title="Inventory Terstruktur"
                  desc="Monitoring jumlah, status, dan pergerakan barang."
                />
                <Highlight
                  icon={<MapPin className="h-4 w-4" />}
                  title="Lokasi & Rak"
                  desc="Akses cepat informasi gudang, zona, dan penempatan."
                />
                <Highlight
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Akses Terjaga"
                  desc="Login session untuk pengelolaan sistem."
                />
              </div>

              <div className="mt-auto pt-10 text-xs text-muted-foreground">
                © {new Date().getFullYear()} PT. Raden Delta Wijaya — Sistem Penempatan Barang
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="p-6 md:p-10">
            {/* Mobile header */}
            <div className="mb-6 flex items-center gap-3 md:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-white shadow-sm">
                <Image
                  src="/img/logo_rdw.png"
                  alt="Logo PT. Raden Delta Wijaya"
                  width={44}
                  height={44}
                  className="object-contain"
                  priority
                />
              </div>

              <div className="leading-tight">
                <div className="text-sm font-semibold">Sistem Penempatan Barang</div>
                <div className="text-xs text-muted-foreground">PT. Raden Delta Wijaya</div>
              </div>
            </div>

            <Card className="border-0 shadow-none">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-xl">Login</CardTitle>
                <div className="mt-2 h-px w-12 bg-primary/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Masuk untuk mengakses dashboard dan data gudang.
                </p>
              </CardHeader>

              <CardContent className="px-0">
                <form className="space-y-4" onSubmit={onSubmit}>
                  {/* Username */}
                  <div className="space-y-1">
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Masukkan username"
                        className="pl-9 focus-visible:ring-primary"
                        autoComplete="username"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type={showPass ? "text" : "password"}
                        placeholder="Masukkan password"
                        className="pl-9 pr-10 focus-visible:ring-primary"
                        autoComplete="current-password"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPass ? "Sembunyikan password" : "Tampilkan password"}
                        disabled={loading}
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error ? (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4" />
                      <div className="leading-snug">{error}</div>
                    </div>
                  ) : null}

                  <Button type="submit" className="w-full gap-2 shadow-sm hover:shadow-md transition" disabled={loading}>
                    <Loader2 className={["h-4 w-4", loading ? "animate-spin" : "hidden"].join(" ")} />
                    {loading ? "Memproses..." : "Login"}
                    <ChevronRight className="h-4 w-4" />
                  </Button>

                  <div className="pt-2 text-center text-[11px] text-muted-foreground">
                    Akses terbatas untuk <span className="font-medium">Admin</span>,{" "}
                    <span className="font-medium">Front Desk</span>,{" "}
                    <span className="font-medium">Teknisi</span>,{" "}
                    <span className="font-medium">Manager</span>.
                  </div>
                </form>
              </CardContent>
            </Card>

            <p className="mt-6 text-center text-xs text-muted-foreground md:hidden">
              © {new Date().getFullYear()} PT. Raden Delta Wijaya – Global Survey
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Highlight({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-background/65 p-4 backdrop-blur-[2px] shadow-sm">
      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}
