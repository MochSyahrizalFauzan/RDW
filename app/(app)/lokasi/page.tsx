"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

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

import {
  Warehouse,
  LayoutGrid,
  Grid3X3,
  Search,
  RefreshCcw,
  Plus,
  MapPin,
  Boxes,
  PackageCheck,
} from "lucide-react";

import WarehouseDialog from "@/components/lokasi/dialogs/WarehouseDialog";
import RackDialog from "@/components/lokasi/dialogs/RackDialog";
import SlotDialog from "@/components/lokasi/dialogs/SlotDialog";

import { apiGet, apiPost } from "@/lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRow = any;

function buildQuery(params: Record<string, any>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (!s) return;
    sp.set(k, s);
  });
  return sp.toString() ? `?${sp.toString()}` : "";
}

function toneOccupied(occupied: boolean) {
  return occupied
    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
    : "bg-muted text-foreground hover:bg-muted";
}

function uniqueBy<T>(arr: T[], keyFn: (x: T) => string | number) {
  const m = new Map<string | number, T>();
  for (const item of arr) m.set(keyFn(item), item);
  return Array.from(m.values());
}

export default function LokasiPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL params
  const urlWarehouseId = searchParams.get("warehouse_id");
  const urlRackId = searchParams.get("rack_id");
  const urlSlotId = searchParams.get("slot_id");

  // role
  const [role, setRole] = useState("admin");
  useEffect(() => {
    setRole(localStorage.getItem("role") || "admin");
  }, []);
  const isAdmin = role === "admin";

  const [loading, setLoading] = useState(false);

  const [warehouses, setWarehouses] = useState<AnyRow[]>([]);
  const [racks, setRacks] = useState<AnyRow[]>([]);
  const [slots, setSlots] = useState<AnyRow[]>([]);

  // selection
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [selectedRackId, setSelectedRackId] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  // search
  const [qWarehouse, setQWarehouse] = useState("");
  const [qRack, setQRack] = useState("");
  const [qSlot, setQSlot] = useState("");

  // dialogs
  const [openWH, setOpenWH] = useState(false);
  const [openRack, setOpenRack] = useState(false);
  const [openSlot, setOpenSlot] = useState(false);

  // forms
  const [whForm, setWhForm] = useState({
    warehouse_code: "",
    warehouse_name: "",
    address: "",
    capacity: "",
  });

  const [rackForm, setRackForm] = useState({
    warehouse_id: "",
    rack_code: "",
    zone: "",
    capacity: "",
  });

  const [slotForm, setSlotForm] = useState({
    rack_id: "",
    slot_code: "",
    slot_label: "",
    notes: "",
  });

  // ========= Fetch helpers (RETURN data, set state di satu tempat) =========
  async function fetchWarehouses() {
    return await apiGet<any[]>("/api/warehouses");
  }
  async function fetchRacks(warehouse_id?: string) {
    const q = buildQuery({ warehouse_id: warehouse_id || undefined });
    return await apiGet<any[]>(`/api/racks${q}`);
  }
  async function fetchSlots(rack_id?: string, warehouse_id?: string) {
    const q = buildQuery({
      rack_id: rack_id || undefined,
      warehouse_id: warehouse_id || undefined,
    });
    return await apiGet<any[]>(`/api/slots${q}`);
  }

  // ========= Init selection dari URL (sekali saja) =========
  const didInitFromUrl = useRef(false);
  useEffect(() => {
    if (didInitFromUrl.current) return;
    didInitFromUrl.current = true;

    if (urlWarehouseId) setSelectedWarehouseId(String(urlWarehouseId));
    if (urlRackId) setSelectedRackId(String(urlRackId));
    if (urlSlotId) setSelectedSlotId(String(urlSlotId));
  }, [urlWarehouseId, urlRackId, urlSlotId]);

  // ========= Token untuk cegah race condition (double render dev) =========
  const reqToken = useRef(0);

  // ========= Core Loader (SINGLE SOURCE OF TRUTH) =========
  async function loadAll(mode: "normal" | "force" = "normal") {
    const token = ++reqToken.current;

    setLoading(true);
    try {
      // optional: kalau force, bersihkan state dulu biar ga flicker key
      if (mode === "force") {
        setRacks([]);
        setSlots([]);
      }

      const wh = await fetchWarehouses();
      if (token !== reqToken.current) return;
      setWarehouses(wh);

      // Bila belum pilih gudang, tapi ada urlSlotId / urlRackId, coba derive chain (best-effort)
      let wid = selectedWarehouseId || "";
      let rid = selectedRackId || "";

      // 1) kalau warehouse_id ada di url
      if (!wid && urlWarehouseId) wid = String(urlWarehouseId);

      // 2) kalau rack_id ada di url tapi warehouse belum ada -> cari warehouse dari racks per warehouse (best-effort)
      if (!wid && urlRackId) {
        // scan per gudang
        for (const w of wh) {
          const wId = String(w.warehouse_id);
          const rackList = await fetchRacks(wId);
          if (token !== reqToken.current) return;
          const hit = rackList.find((r: any) => String(r.rack_id) === String(urlRackId));
          if (hit) {
            wid = wId;
            rid = String(urlRackId);
            break;
          }
        }
      }

      // 3) kalau slot_id ada di url dan warehouse belum ada -> cari chain slot
      if (!wid && urlSlotId) {
        outer: for (const w of wh) {
          const wId = String(w.warehouse_id);
          const rackList = await fetchRacks(wId);
          if (token !== reqToken.current) return;

          for (const r of rackList) {
            const rId = String(r.rack_id);
            const slotList = await fetchSlots(rId, wId);
            if (token !== reqToken.current) return;

            const hit = slotList.find((s: any) => String(s.slot_id) === String(urlSlotId));
            if (hit) {
              wid = wId;
              rid = rId;
              setSelectedSlotId(String(urlSlotId));
              break outer;
            }
          }
        }
      }

      // apply selection hasil derive (sekali)
      if (wid && wid !== selectedWarehouseId) setSelectedWarehouseId(wid);
      if (rid && rid !== selectedRackId) setSelectedRackId(rid);

      // jika tetap belum ada warehouse, stop
      if (!wid) {
        setRacks([]);
        setSlots([]);
        return;
      }

      // load racks untuk warehouse terpilih
      const rackList = await fetchRacks(wid);
      if (token !== reqToken.current) return;
      setRacks(rackList);

      // validasi rack (kalau rack_id tidak ada di warehouse itu, reset)
      if (rid) {
        const exists = rackList.some((r: any) => String(r.rack_id) === String(rid));
        if (!exists) {
          rid = "";
          setSelectedRackId("");
          setSelectedSlotId("");
        }
      }

      // load slots (by rack jika ada, kalau tidak by warehouse)
      const slotList = rid
        ? await fetchSlots(rid, wid)
        : await fetchSlots(undefined, wid);

      if (token !== reqToken.current) return;

      // ✅ dedup final (ini yang menghilangkan error key)
      setSlots(uniqueBy(slotList, (s: any) => String(s.slot_id)));

      // derive rack dari slot selection bila perlu
      if (!rid && selectedSlotId) {
        const hit = slotList.find((s: any) => String(s.slot_id) === String(selectedSlotId));
        if (hit) setSelectedRackId(String(hit.rack_id));
      }
    } catch (e: any) {
      console.error("LOKASI LOAD ERROR:", e);
      alert(e?.message || "Gagal memuat lokasi");
    } finally {
      if (token === reqToken.current) setLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    loadAll("normal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload saat selection berubah (TAPI: jangan double-load kalau perubahan berasal dari loadAll)
  // Kita tetap reload, tapi aman karena token & dedup.
  useEffect(() => {
    // kalau belum ada gudang, ga perlu
    if (!selectedWarehouseId) return;

    // reset UI state yang dependent supaya tidak “nyangkut”
    setSlots([]);
    setSelectedSlotId((prev) => prev); // keep

    loadAll("normal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseId, selectedRackId]);

  // ========= Filters =========
  const whFiltered = useMemo(() => {
    const term = qWarehouse.trim().toLowerCase();
    if (!term) return warehouses;
    return warehouses.filter((w) => {
      const s = `${w.warehouse_code} ${w.warehouse_name} ${w.address ?? ""}`.toLowerCase();
      return s.includes(term);
    });
  }, [warehouses, qWarehouse]);

  const rackFiltered = useMemo(() => {
    const term = qRack.trim().toLowerCase();
    let base = racks;
    if (selectedWarehouseId) {
      base = base.filter((r) => String(r.warehouse_id) === String(selectedWarehouseId));
    }
    if (!term) return base;
    return base.filter((r) => {
      const s = `${r.rack_code} ${r.zone ?? ""} ${r.warehouse_code ?? ""}`.toLowerCase();
      return s.includes(term);
    });
  }, [racks, qRack, selectedWarehouseId]);

  const slotFiltered = useMemo(() => {
    const term = qSlot.trim().toLowerCase();
    let base = slots;

    if (selectedRackId) {
      base = base.filter((s) => String(s.rack_id) === String(selectedRackId));
    }

    if (!term) return base;
    return base.filter((s) => {
      const txt =
        `${s.slot_code} ${s.slot_label ?? ""} ${s.rack_code ?? ""} ${s.warehouse_code ?? ""} ${s.equipment_code ?? ""} ${s.equipment_name ?? ""}`.toLowerCase();
      return txt.includes(term);
    });
  }, [slots, qSlot, selectedRackId]);

  // ========= KPI =========
  const kpi = useMemo(() => {
    const totalWH = warehouses.length;
    const totalRack = racks.length;
    const totalSlot = slots.length;
    const occupied = slots.filter((s) => !!s.equipment_id).length;
    return { totalWH, totalRack, totalSlot, occupied };
  }, [warehouses, racks, slots]);

  // ========= Selected details =========
  const selectedWarehouse = useMemo(() => {
    return (
      warehouses.find((w) => String(w.warehouse_id) === String(selectedWarehouseId)) || null
    );
  }, [warehouses, selectedWarehouseId]);

  const selectedRack = useMemo(() => {
    return racks.find((r) => String(r.rack_id) === String(selectedRackId)) || null;
  }, [racks, selectedRackId]);

  const selectedSlotDetail = useMemo(() => {
    if (!selectedSlotId) return null;
    return slots.find((s) => String(s.slot_id) === String(selectedSlotId)) || null;
  }, [slots, selectedSlotId]);

  // ========= Slot scroll/highlight =========
  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!selectedSlotId) return;
    const el = slotRefs.current[String(selectedSlotId)];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedSlotId, slotFiltered]);

  // =======================
  // Actions: create
  // =======================
  async function submitWarehouse() {
    try {
      if (!isAdmin) return alert("Akses ditolak: hanya admin");
      if (!whForm.warehouse_code || !whForm.warehouse_name) {
        return alert("Kode gudang dan nama gudang wajib");
      }

      await apiPost(`/api/warehouses`, {
        warehouse_code: whForm.warehouse_code.trim(),
        warehouse_name: whForm.warehouse_name.trim(),
        address: whForm.address.trim() || null,
        capacity: whForm.capacity ? Number(whForm.capacity) : null,
      });

      setOpenWH(false);
      setWhForm({ warehouse_code: "", warehouse_name: "", address: "", capacity: "" });
      await loadAll("force");
    } catch (e: any) {
      console.error("ADD WH ERROR:", e);
      alert(e?.message || "Gagal tambah gudang");
    }
  }

  async function submitRack() {
    try {
      if (!isAdmin) return alert("Akses ditolak: hanya admin");
      const wid = rackForm.warehouse_id || selectedWarehouseId;
      if (!wid || !rackForm.rack_code) return alert("Pilih gudang dan isi kode rak");

      await apiPost(`/api/racks`, {
        warehouse_id: Number(wid),
        rack_code: rackForm.rack_code.trim(),
        zone: rackForm.zone.trim() || null,
        capacity: rackForm.capacity ? Number(rackForm.capacity) : null,
      });

      setOpenRack(false);
      setRackForm({ warehouse_id: "", rack_code: "", zone: "", capacity: "" });

      if (!selectedWarehouseId) setSelectedWarehouseId(String(wid));
      await loadAll("force");
    } catch (e: any) {
      console.error("ADD RACK ERROR:", e);
      alert(e?.message || "Gagal tambah rak");
    }
  }

  async function submitSlot() {
    try {
      if (!isAdmin) return alert("Akses ditolak: hanya admin");
      const rid = slotForm.rack_id || selectedRackId;
      if (!rid || !slotForm.slot_code) return alert("Pilih rak dan isi kode slot");

      await apiPost(`/api/slots`, {
        rack_id: Number(rid),
        slot_code: slotForm.slot_code.trim(),
        slot_label: slotForm.slot_label.trim() || null,
        notes: slotForm.notes.trim() || null,
      });

      setOpenSlot(false);
      setSlotForm({ rack_id: "", slot_code: "", slot_label: "", notes: "" });

      if (!selectedRackId) setSelectedRackId(String(rid));
      await loadAll("force");
    } catch (e: any) {
      console.error("ADD SLOT ERROR:", e);
      alert(e?.message || "Gagal tambah slot");
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Lokasi</h1>
          <p className="text-sm text-muted-foreground">
            Gudang → Rak → Slot (dengan status terisi/kosong)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => loadAll("force")}
            className="gap-2"
            disabled={loading}
          >
            <RefreshCcw className="h-4 w-4" />
            {loading ? "Memuat..." : "Refresh"}
          </Button>

          {isAdmin && (
            <>
              <Button onClick={() => setOpenWH(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Tambah Gudang
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setRackForm((p) => ({ ...p, warehouse_id: selectedWarehouseId || "" }));
                  setOpenRack(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Tambah Rak
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSlotForm((p) => ({ ...p, rack_id: selectedRackId || "" }));
                  setOpenSlot(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Tambah Slot
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI */}
      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard title="Gudang" value={kpi.totalWH} icon={<Warehouse className="h-5 w-5" />} />
        <KpiCard title="Rak" value={kpi.totalRack} icon={<LayoutGrid className="h-5 w-5" />} />
        <KpiCard title="Slot" value={kpi.totalSlot} icon={<Grid3X3 className="h-5 w-5" />} />
        <KpiCard title="Slot Terisi" value={kpi.occupied} icon={<PackageCheck className="h-5 w-5" />} />
      </div>

      {/* Main layout */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT */}
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Explorer Lokasi</CardTitle>
            <CardDescription>Pilih gudang dan rak untuk melihat slot</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Warehouse selector */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-semibold">Gudang</div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={qWarehouse}
                    onChange={(e) => setQWarehouse(e.target.value)}
                    placeholder="Cari gudang..."
                    className="pl-9"
                  />
                </div>

                <div className="rounded-xl border overflow-hidden">
                  <div className="max-h-[260px] overflow-auto">
                    {whFiltered.map((w) => {
                      const active = String(w.warehouse_id) === String(selectedWarehouseId);
                      return (
                        <button
                          key={`wh-${w.warehouse_id}`}
                          onClick={() => {
                            setSelectedWarehouseId(String(w.warehouse_id));
                            setSelectedRackId("");
                            setSelectedSlotId("");
                            router.replace("/lokasi");
                          }}
                          className={[
                            "w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/40 transition",
                            active ? "bg-muted/60" : "",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold">
                              {w.warehouse_code} — {w.warehouse_name}
                            </div>
                            {active && <Badge variant="secondary">Selected</Badge>}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground line-clamp-1">
                            {w.address || "-"}
                          </div>
                        </button>
                      );
                    })}

                    {whFiltered.length === 0 && (
                      <div className="p-4 text-sm text-muted-foreground">Tidak ada gudang.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Rack selector */}
              <div className="space-y-2">
                <div className="text-sm font-semibold">Rak</div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={qRack}
                    onChange={(e) => setQRack(e.target.value)}
                    placeholder="Cari rak..."
                    className="pl-9"
                    disabled={!selectedWarehouseId}
                  />
                </div>

                <div className="rounded-xl border overflow-hidden">
                  <div className="max-h-[260px] overflow-auto">
                    {!selectedWarehouseId ? (
                      <div className="p-4 text-sm text-muted-foreground">
                        Pilih gudang terlebih dahulu.
                      </div>
                    ) : (
                      <>
                        {rackFiltered.map((r) => {
                          const active = String(r.rack_id) === String(selectedRackId);
                          return (
                            <button
                              key={`rack-${r.rack_id}`}
                              onClick={() => {
                                setSelectedRackId(String(r.rack_id));
                                setSelectedSlotId("");
                                router.replace("/lokasi");
                              }}
                              className={[
                                "w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/40 transition",
                                active ? "bg-muted/60" : "",
                              ].join(" ")}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold">
                                  {r.rack_code} {r.zone ? `(${r.zone})` : ""}
                                </div>
                                {active && <Badge variant="secondary">Selected</Badge>}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                Gudang: {r.warehouse_code}
                              </div>
                            </button>
                          );
                        })}

                        {rackFiltered.length === 0 && (
                          <div className="p-4 text-sm text-muted-foreground">
                            Belum ada rak di gudang ini.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Slots */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Slot</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedRackId
                      ? "Menampilkan slot pada rak terpilih"
                      : selectedWarehouseId
                      ? "Menampilkan slot pada seluruh gudang (opsional)"
                      : "Pilih gudang dahulu"}
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={qSlot}
                    onChange={(e) => setQSlot(e.target.value)}
                    placeholder="Cari slot / equipment..."
                    className="pl-9 w-[260px] max-w-[80vw]"
                    disabled={!selectedWarehouseId}
                  />
                </div>
              </div>

              <div className="rounded-xl border overflow-hidden">
                <div className="max-h-[360px] overflow-auto">
                  {!selectedWarehouseId ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      Pilih gudang terlebih dahulu.
                    </div>
                  ) : slotFiltered.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      Tidak ada slot sesuai filter.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {slotFiltered.map((s) => {
                        const occupied = !!s.equipment_id;
                        const isFocused =
                          selectedSlotId && String(s.slot_id) === String(selectedSlotId);

                        return (
                          <div
                            key={`slot-${s.slot_id}`} // ✅ aman + jelas
                            ref={(el) => {
                              slotRefs.current[String(s.slot_id)] = el;
                            }}
                            className={[
                              "p-3 hover:bg-muted/30 transition cursor-pointer",
                              isFocused ? "bg-primary/10 ring-1 ring-primary/30" : "",
                            ].join(" ")}
                            onClick={() => setSelectedSlotId(String(s.slot_id))}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="font-mono">
                                  {s.slot_code}
                                </Badge>
                                <div className="text-sm font-semibold">
                                  {s.slot_label || `${s.rack_code} • ${s.warehouse_code}`}
                                </div>
                              </div>
                              <Badge className={toneOccupied(occupied)}>
                                {occupied ? "Terisi" : "Kosong"}
                              </Badge>
                            </div>

                            <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                              <span className="font-mono">
                                {s.warehouse_code}/{s.rack_code}
                              </span>
                              <span>•</span>
                              {occupied ? (
                                <span className="flex items-center gap-2">
                                  <Boxes className="h-4 w-4" />
                                  <span className="font-mono">{s.equipment_code}</span> —{" "}
                                  {s.equipment_name}
                                </span>
                              ) : (
                                <span>—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle>Detail</CardTitle>
            <CardDescription>Ringkasan lokasi terpilih</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-xl border p-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Warehouse className="h-4 w-4" />
                Gudang
              </div>
              <div className="mt-2 text-sm">
                {selectedWarehouse ? (
                  <>
                    <div className="font-semibold">
                      {selectedWarehouse.warehouse_code} — {selectedWarehouse.warehouse_name}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="line-clamp-2">{selectedWarehouse.address || "-"}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">Belum dipilih</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Rak
              </div>
              <div className="mt-2 text-sm">
                {selectedRack ? (
                  <>
                    <div className="font-semibold">
                      {selectedRack.rack_code} {selectedRack.zone ? `(${selectedRack.zone})` : ""}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Kapasitas (opsional): {selectedRack.capacity ?? "-"}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">Belum dipilih</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" />
                Slot (Detail)
              </div>

              <div className="mt-2 text-sm">
                {selectedSlotDetail ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold font-mono">{selectedSlotDetail.slot_code}</div>
                      <Badge className={toneOccupied(!!selectedSlotDetail.equipment_id)}>
                        {!!selectedSlotDetail.equipment_id ? "Terisi" : "Kosong"}
                      </Badge>
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground">
                      Label: {selectedSlotDetail.slot_label || "-"}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Catatan: {selectedSlotDetail.notes || "-"}
                    </div>

                    {!!selectedSlotDetail.equipment_id && (
                      <div className="mt-3 rounded-lg border bg-muted/20 p-2">
                        <div className="text-xs font-semibold">Equipment</div>
                        <div className="mt-1 text-sm font-mono">
                          {selectedSlotDetail.equipment_code}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {selectedSlotDetail.equipment_name}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Klik salah satu slot untuk melihat detail.
                  </div>
                )}
              </div>
            </div>

            {!isAdmin && (
              <div className="text-xs text-muted-foreground">
                * Tambah Gudang/Rak/Slot hanya untuk Admin.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <WarehouseDialog
        open={openWH}
        onOpenChange={setOpenWH}
        isAdmin={isAdmin}
        form={whForm}
        setForm={setWhForm}
        onSubmit={submitWarehouse}
      />

      <RackDialog
        open={openRack}
        onOpenChange={setOpenRack}
        isAdmin={isAdmin}
        form={rackForm}
        setForm={setRackForm}
        warehouses={warehouses}
        selectedWarehouseId={selectedWarehouseId}
        onSubmit={submitRack}
      />

      <SlotDialog
        open={openSlot}
        onOpenChange={setOpenSlot}
        isAdmin={isAdmin}
        form={slotForm}
        setForm={setSlotForm}
        racks={racks}
        selectedWarehouseId={selectedWarehouseId}
        selectedRackId={selectedRackId}
        onSubmit={submitSlot}
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="mt-1 text-2xl font-extrabold">{value}</div>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl border bg-background text-muted-foreground">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
