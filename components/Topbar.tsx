"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bell,
  Search,
  ChevronDown,
  Package,
  Warehouse,
  LayoutGrid,
  MapPin,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";

type SearchItem = {
  type: "equipment" | "class" | "warehouse" | "rack" | "slot" | string;
  id: number | string;
  title: string;
  subtitle?: string;
  href: string;
};

function iconByType(type: string) {
  switch (type) {
    case "equipment":
      return <Package className="h-4 w-4" />;
    case "class":
      return <LayoutGrid className="h-4 w-4" />;
    case "warehouse":
      return <Warehouse className="h-4 w-4" />;
    case "rack":
    case "slot":
      return <MapPin className="h-4 w-4" />;
    default:
      return <Search className="h-4 w-4" />;
  }
}

function groupLabel(type: string) {
  switch (type) {
    case "equipment":
      return "Inventory";
    case "class":
      return "Kelas";
    case "warehouse":
      return "Gudang";
    case "rack":
      return "Rak";
    case "slot":
      return "Slot";
    default:
      return "Lainnya";
  }
}

function roleLabel(role: string) {
  const r = (role || "").toLowerCase();
  if (r === "admin") return "Admin";
  if (r === "frontdesk") return "Front Desk";
  if (r === "teknisi") return "Teknisi";
  if (r === "manager") return "General Manager";
  return role || "-";
}

function initials(name: string) {
  const parts = (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  const ini = parts.map((p) => p[0]?.toUpperCase()).join("");
  return ini || "U";
}

function clearAuthStorage() {
  try {
    localStorage.removeItem("user");
    localStorage.removeItem("full_name");
    localStorage.removeItem("role");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
  } catch {
    // ignore
  }
}

export default function Topbar() {
  const router = useRouter();

  // outside click refs
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const userWrapRef = useRef<HTMLDivElement | null>(null);

  // user from localStorage
  const [fullName, setFullName] = useState("User");
  const [role, setRole] = useState("admin");

  // search state
  const [q, setQ] = useState("");
  const [openSearch, setOpenSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  // user menu
  const [openUserMenu, setOpenUserMenu] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // prevent race condition for search
  const searchSeq = useRef(0);

  // load user once
  useEffect(() => {
    const n = localStorage.getItem("full_name") || "User";
    const r = localStorage.getItem("role") || "admin";
    setFullName(n);
    setRole(r);
  }, []);

  // Debounce search
  useEffect(() => {
    const term = q.trim();

    if (!term) {
      setResults([]);
      setOpenSearch(false);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    setOpenSearch(true);
    setLoading(true);

    const t = setTimeout(async () => {
      const seq = ++searchSeq.current;
      try {
        const json = await apiGet<any>(`/api/search?q=${encodeURIComponent(term)}`, {
          // kalau expired session -> api.ts redirect
          // tapi untuk safety (biar ga error toast spam saat ngetik di login page)
          silent401: true,
        });

        // kalau ada request baru, abaikan hasil lama
        if (seq !== searchSeq.current) return;

        const list = Array.isArray(json?.results) ? (json.results as SearchItem[]) : [];
        setResults(list);
        setActiveIndex(list.length ? 0 : -1);
      } catch {
        if (seq !== searchSeq.current) return;
        setResults([]);
        setActiveIndex(-1);
      } finally {
        if (seq === searchSeq.current) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [q]);

  // Close dropdowns on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;

      if (searchWrapRef.current && !searchWrapRef.current.contains(t)) {
        setOpenSearch(false);
      }
      if (userWrapRef.current && !userWrapRef.current.contains(t)) {
        setOpenUserMenu(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Group results
  const grouped = useMemo(() => {
    const map = new Map<string, SearchItem[]>();
    for (const it of results) {
      const key = groupLabel(it.type);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [results]);

  function goTo(item?: SearchItem) {
    if (item?.href) {
      router.push(item.href);
      setOpenSearch(false);
      return;
    }

    const term = q.trim();
    if (term) {
      router.push(`/databarang?q=${encodeURIComponent(term)}`);
      setOpenSearch(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!openSearch) return;

    if (e.key === "Escape") {
      setOpenSearch(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      goTo(results[activeIndex]);
      return;
    }
  }

function clearAuthStorage() {
  try {
    localStorage.removeItem("user");
    localStorage.removeItem("full_name");
    localStorage.removeItem("role");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
  } catch {}
}

async function handleLogout() {
  const t = toast.loading("Logout...");
  try {
    setLogoutLoading(true);

    // best effort (kalau session sudah mati, tetap clear lokal)
    await apiPost("/api/auth/logout").catch(() => null);

    clearAuthStorage();
    setOpenUserMenu(false);

    toast.success("Logout berhasil", { id: t });
    router.replace("/login");
  } catch (e: any) {
    clearAuthStorage();
    setOpenUserMenu(false);

    toast.error("Logout gagal", { id: t, description: e?.message || "Keluar lokal saja." });
    router.replace("/login");
  } finally {
    setLogoutLoading(false);
  }
}


  return (
    <header className="h-16 w-full border-b bg-background">
      <div className="mx-auto flex h-full w-full items-center gap-4 px-5">
        {/* Search */}
        <div ref={searchWrapRef} className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => q.trim() && setOpenSearch(true)}
            onKeyDown={onKeyDown}
            className="pl-9 bg-muted/30 focus-visible:ring-primary"
            placeholder="Cari equipment, serial number, gudang, rak, slot, kelas..."
          />

          {/* Dropdown */}
          {openSearch && q.trim() ? (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border bg-background shadow-lg">
              <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
                <span>{loading ? "Mencari..." : `Hasil untuk: "${q.trim()}"`}</span>
                <span className="text-[11px] font-semibold">{results.length}</span>
              </div>

              {loading ? (
                <div className="p-3 text-sm text-muted-foreground">Memuat hasil...</div>
              ) : results.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  Tidak ada hasil. Tekan <span className="font-medium">Enter</span>{" "}
                  untuk cari di Inventory.
                </div>
              ) : (
                <div className="max-h-[340px] overflow-auto">
                  {grouped.map(([groupName, list]) => (
                    <div key={groupName} className="py-2">
                      <div className="px-3 pb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {groupName}
                      </div>

                      <div className="space-y-1 px-2">
                        {list.map((it) => {
                          const globalIndex = results.findIndex(
                            (x) => x.type === it.type && x.id === it.id
                          );
                          const active = globalIndex === activeIndex;

                          return (
                            <button
                              key={`${it.type}-${it.id}`}
                              type="button"
                              onMouseEnter={() => setActiveIndex(globalIndex)}
                              onClick={() => goTo(it)}
                              className={[
                                "w-full flex items-start gap-3 rounded-lg px-2 py-2 text-left transition",
                                active ? "bg-muted" : "hover:bg-muted/70",
                              ].join(" ")}
                            >
                              <div className="mt-0.5 text-primary">{iconByType(it.type)}</div>

                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{it.title}</div>
                                {it.subtitle ? (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {it.subtitle}
                                  </div>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                Tips: gunakan ↑ ↓ untuk pilih, Enter untuk buka, Esc untuk tutup.
              </div>
            </div>
          ) : null}
        </div>

        {/* Right */}
        <div className="ml-auto flex items-center gap-3">
          {/* Bell placeholder
          <Button
            variant="outline"
            size="icon"
            className="relative"
            onClick={() => toast.info("Notifikasi", { description: "Fitur notifikasi belum diaktifkan." })}
          >
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 text-[10px] bg-black text-white rounded-full px-1.5 py-0.5">
              3
            </span>
          </Button> */}

          {/* User + Dropdown */}
          <div ref={userWrapRef} className="relative">
            <button
              type="button"
              onClick={() => setOpenUserMenu((v) => !v)}
              className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted/40 transition"
            >
              <div className="h-9 w-9 rounded-full bg-muted border grid place-items-center text-xs font-semibold">
                {initials(fullName)}
              </div>

              <div className="leading-tight text-left hidden sm:block">
                <div className="text-sm font-semibold line-clamp-1">{fullName}</div>
                <div className="text-xs text-muted-foreground">{roleLabel(role)}</div>
              </div>

              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {openUserMenu ? (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 overflow-hidden rounded-xl border bg-background shadow-lg">
                <div className="px-3 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{fullName}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {roleLabel(role)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  <Button
                    variant="destructive"
                    className="w-full justify-start gap-2"
                    onClick={handleLogout}
                    disabled={logoutLoading}
                  >
                    <LogOut className="h-4 w-4" />
                    {logoutLoading ? "Logging out..." : "Logout"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
