"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  Dialog,
  DialogContent,
  DialogDescription as DialogDesc,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Settings as SettingsIcon,
  User as UserIcon,
  Shield,
  LogOut,
  Save,
  Users,
  Plus,
  KeyRound,
  AlertTriangle,
  Moon,
  Sun,
} from "lucide-react";

import { apiGet, apiPost, apiPatch } from "@/lib/api";

type Me = {
  user_id: number;
  full_name: string;
  username: string;
  role: "admin" | "frontdesk" | "teknisi" | "manager" | string;
  is_active: number;
  last_login_at?: string | null;
  created_at?: string;
};

type UserRow = {
  user_id: number;
  full_name: string;
  username: string;
  role: "admin" | "frontdesk" | "teknisi" | "manager" | string;
  is_active: number;
  created_at?: string;
};

function roleBadge(role: string) {
  const v = String(role || "").toLowerCase();
  if (v === "admin") return "bg-black text-white hover:bg-black";
  if (v === "manager") return "bg-sky-100 text-sky-800 hover:bg-sky-100";
  if (v === "teknisi") return "bg-amber-100 text-amber-800 hover:bg-amber-100";
  if (v === "frontdesk") return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
  return "bg-muted text-foreground hover:bg-muted";
}

async function getMe(): Promise<Me> {
  // Backend kamu sudah pasti punya /api/auth/me
  // Tapi kita tetap fallback kalau kamu nanti bikin /api/me
  try {
    // jika suatu saat kamu bikin alias /api/me
    return await apiGet<{ user: Me } | Me>("/api/me").then((x: any) => (x?.user ? x.user : x));
  } catch {
    const res = await apiGet<{ user: Me }>("/api/auth/me");
    return res.user;
  }
}

export default function SettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  // profil form
  const [fullName, setFullName] = useState("");
  const [notes, setNotes] = useState("");

  // ui prefs (localStorage)
  const [compactMode, setCompactMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // admin: user management
  const [users, setUsers] = useState<UserRow[]>([]);
  const [openAddUser, setOpenAddUser] = useState(false);

  const [newUser, setNewUser] = useState({
    full_name: "",
    username: "",
    password: "",
    role: "frontdesk",
    is_active: "1",
  });

  const isAdmin = useMemo(() => {
    return (me?.role || "").toLowerCase() === "admin";
  }, [me]);

  // ===== load prefs from localStorage
  useEffect(() => {
    const cm = localStorage.getItem("pref_compact") === "1";
    const dm = localStorage.getItem("pref_dark") === "1";
    setCompactMode(cm);
    setDarkMode(dm);

    document.documentElement.classList.toggle("dark", dm);
  }, []);

  // ===== apply prefs
  useEffect(() => {
    localStorage.setItem("pref_compact", compactMode ? "1" : "0");
  }, [compactMode]);

  useEffect(() => {
    localStorage.setItem("pref_dark", darkMode ? "1" : "0");
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  async function load() {
    setLoading(true);
    try {
      const meRes = await getMe();
      setMe(meRes);
      setFullName(meRes.full_name || "");
      setNotes("");

      // simpan untuk page lain yg masih pakai localStorage role/user_id
      localStorage.setItem("role", meRes.role || "admin");
      localStorage.setItem("user_id", String(meRes.user_id || 1));
      localStorage.setItem("username", meRes.username || "");

      if ((meRes.role || "").toLowerCase() === "admin") {
        const list = await apiGet<UserRow[]>("/api/users");
        setUsers(list);
      } else {
        setUsers([]);
      }
    } catch (e: any) {
      console.error("SETTINGS LOAD ERROR:", e);
      // kalau unauthorized, lib/api.ts akan lempar "Unauthorized" dan client akan redirect /login
      // tapi kalau tidak redirect, kita paksa:
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile() {
    try {
      if (!me) return;
      setLoading(true);

      // NOTE:
      // Backend kamu belum ada endpoint PATCH /api/auth/me di server.js yang kamu kirim.
      // Jadi fitur ini akan error kalau endpoint-nya belum dibuat.
      // Untuk sekarang kita coba /api/me dulu, kalau gagal baru /api/auth/me.
      try {
        await apiPatch("/api/me", {
          full_name: fullName.trim(),
          notes: notes.trim() || null,
        });
      } catch {
        await apiPatch("/api/auth/me", {
          full_name: fullName.trim(),
          notes: notes.trim() || null,
        });
      }

      await load();
      alert("Profil berhasil diperbarui.");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Gagal menyimpan profil");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      setLoading(true);
      await apiPost("/api/auth/logout", {});
    } catch {
      // biar tetap logout dari sisi FE walau endpoint bermasalah
    } finally {
      localStorage.removeItem("role");
      localStorage.removeItem("user_id");
      localStorage.removeItem("username");
      router.replace("/login");
      setLoading(false);
    }
  }

  // ===== Admin actions
  async function submitAddUser() {
    try {
      if (!isAdmin) return alert("Hanya admin yang bisa menambah user.");
      if (!newUser.full_name.trim() || !newUser.username.trim() || !newUser.password) {
        return alert("Nama, username, dan password wajib diisi.");
      }

      setLoading(true);

      await apiPost("/api/users", {
        full_name: newUser.full_name.trim(),
        username: newUser.username.trim(),
        password: newUser.password,
        role: newUser.role,
        is_active: Number(newUser.is_active) ? 1 : 0,
      });

      setOpenAddUser(false);
      setNewUser({
        full_name: "",
        username: "",
        password: "",
        role: "frontdesk",
        is_active: "1",
      });

      const list = await apiGet<UserRow[]>("/api/users");
      setUsers(list);
      alert("User berhasil ditambahkan.");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Gagal tambah user");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(u: UserRow) {
    try {
      if (!isAdmin) return;
      setLoading(true);

      await apiPatch(`/api/users/${u.user_id}`, { is_active: u.is_active ? 0 : 1 });

      const list = await apiGet<UserRow[]>("/api/users");
      setUsers(list);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Gagal update user");
    } finally {
      setLoading(false);
    }
  }

  async function changeRole(u: UserRow, role: string) {
    try {
      if (!isAdmin) return;
      setLoading(true);

      await apiPatch(`/api/users/${u.user_id}`, { role });

      const list = await apiGet<UserRow[]>("/api/users");
      setUsers(list);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Gagal update role");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={["space-y-4", compactMode ? "space-y-3" : ""].join(" ")}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Pengaturan profil, tampilan, dan keamanan sistem.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button variant="destructive" onClick={logout} className="gap-2" disabled={loading}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profile */}
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Profil Akun
            </CardTitle>
            <CardDescription>Informasi akun yang sedang login.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!me ? (
              <div className="text-sm text-muted-foreground">Memuat...</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/60 p-4">
                  <div className="min-w-0">
                    <div className="text-sm text-muted-foreground">Username</div>
                    <div className="font-semibold">{me.username}</div>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm text-muted-foreground">Role</div>
                    <Badge className={roleBadge(me.role)}>{me.role}</Badge>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm text-muted-foreground">Status</div>
                    <Badge variant="secondary">{me.is_active ? "Aktif" : "Nonaktif"}</Badge>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <div className="text-sm font-semibold">Nama Lengkap</div>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nama lengkap"
                    />
                  </div>

                  <div className="grid gap-2">
                    <div className="text-sm font-semibold">Terakhir Login</div>
                    <Input value={me.last_login_at ? String(me.last_login_at) : "-"} disabled />
                  </div>

                  <div className="sm:col-span-2 grid gap-2">
                    <div className="text-sm font-semibold">Catatan (opsional)</div>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Catatan internal (opsional)..."
                    />
                    <div className="text-xs text-muted-foreground">
                      * Jika backend belum simpan notes, kamu bisa hapus field ini.
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={saveProfile} className="gap-2" disabled={loading}>
                    <Save className="h-4 w-4" />
                    Simpan Profil
                  </Button>

                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => alert("Fitur ganti password bisa kita integrasikan berikutnya.")}
                  >
                    <KeyRound className="h-4 w-4" />
                    Ganti Password
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Preferences + Security */}
        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-4 w-4" />
                Tampilan
              </CardTitle>
              <CardDescription>Preferensi UI untuk perangkat ini.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Mode Ringkas</div>
                  <div className="text-xs text-muted-foreground">
                    Mengurangi jarak/padding untuk tabel & kartu.
                  </div>
                </div>
                <Switch checked={compactMode} onCheckedChange={setCompactMode} />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Dark Mode
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Mengaktifkan tema gelap (class <code>dark</code>).
                  </div>
                </div>
                <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Admin-only: User management */}
      {isAdmin && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Manajemen User (Admin)
                </CardTitle>
                <CardDescription>Kelola akun & role pengguna sistem.</CardDescription>
              </div>

              <Dialog open={openAddUser} onOpenChange={setOpenAddUser}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Tambah User
                  </Button>
                </DialogTrigger>

                <DialogContent className="sm:max-w-[640px]">
                  <DialogHeader>
                    <DialogTitle>Tambah User</DialogTitle>
                    <DialogDesc>Buat akun baru untuk pengguna sistem.</DialogDesc>
                  </DialogHeader>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <div className="text-sm font-semibold">Nama Lengkap *</div>
                      <Input
                        value={newUser.full_name}
                        onChange={(e) => setNewUser((p) => ({ ...p, full_name: e.target.value }))}
                        placeholder="Nama"
                      />
                    </div>

                    <div className="grid gap-2">
                      <div className="text-sm font-semibold">Username *</div>
                      <Input
                        value={newUser.username}
                        onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                        placeholder="username"
                        autoComplete="off"
                      />
                    </div>

                    <div className="grid gap-2">
                      <div className="text-sm font-semibold">Password *</div>
                      <Input
                        value={newUser.password}
                        onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                        placeholder="••••••••"
                        type="password"
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="grid gap-2">
                      <div className="text-sm font-semibold">Role</div>
                      <Select
                        value={newUser.role}
                        onValueChange={(v) => setNewUser((p) => ({ ...p, role: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">admin</SelectItem>
                          <SelectItem value="manager">manager</SelectItem>
                          <SelectItem value="teknisi">teknisi</SelectItem>
                          <SelectItem value="frontdesk">frontdesk</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <div className="text-sm font-semibold">Status</div>
                      <Select
                        value={newUser.is_active}
                        onValueChange={(v) => setNewUser((p) => ({ ...p, is_active: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Aktif</SelectItem>
                          <SelectItem value="0">Nonaktif</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpenAddUser(false)}>
                      Batal
                    </Button>
                    <Button onClick={submitAddUser} disabled={loading}>
                      Simpan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="rounded-xl border overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr className="text-left">
                    <th className="px-3 py-2">Nama</th>
                    <th className="px-3 py-2">Username</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id} className="border-t">
                      <td className="px-3 py-2 font-semibold">{u.full_name}</td>
                      <td className="px-3 py-2">{u.username}</td>
                      <td className="px-3 py-2">
                        <Select value={u.role} onValueChange={(v) => changeRole(u, v)}>
                          <SelectTrigger className="h-8 w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="manager">manager</SelectItem>
                            <SelectItem value="teknisi">teknisi</SelectItem>
                            <SelectItem value="frontdesk">frontdesk</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">{u.is_active ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleActive(u)}
                          disabled={loading}
                        >
                          {u.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      </td>
                    </tr>
                  ))}

                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                        Belum ada user.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Separator className="my-4" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
