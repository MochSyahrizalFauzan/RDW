"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Dialog,
  DialogContent,
  DialogDescription as DialogDesc,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Textarea } from "@/components/ui/textarea";

import {
  Boxes,
  Search,
  RefreshCcw,
  Package,
  CheckCircle2,
  Wrench,
  Ruler,
  Handshake,
  AlertTriangle,
  XCircle,
  Ban,
} from "lucide-react";

import { toast } from "sonner";
import EquipmentRowActions from "@/components/equipment/EquipmentRowActions";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

type EquipmentRow = any;

type PagedResponse<T> = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  rows: T[];
};

type EquipmentStats = {
  total: number;
  ready: number;
  disewa: number;
  servis: number;
  kalibrasi: number;
  rusak?: number;
  hilang?: number;
};

const STATUSES = ["Ready", "Disewa", "Servis", "Kalibrasi", "Rusak", "Hilang"] as const;

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

function uniqueBy<T>(arr: T[], keyFn: (x: T) => string | number) {
  const m = new Map<string | number, T>();
  for (const item of arr || []) {
    const k = keyFn(item);
    if (k === undefined || k === null) continue;
    if (!m.has(k)) m.set(k, item);
  }
  return Array.from(m.values());
}

function statusTone(status: string) {
  const v = String(status || "").toLowerCase();
  if (v.includes("ready")) return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
  if (v.includes("disewa") || v.includes("sewa")) return "bg-violet-100 text-violet-800 hover:bg-violet-100";
  if (v.includes("servis") || v.includes("service")) return "bg-amber-100 text-amber-800 hover:bg-amber-100";
  if (v.includes("kalibrasi")) return "bg-sky-100 text-sky-800 hover:bg-sky-100";
  if (v.includes("rusak") || v.includes("hilang")) return "bg-rose-100 text-rose-800 hover:bg-rose-100";
  return "bg-muted text-foreground hover:bg-muted";
}

function StatusBadge({ status }: { status: string }) {
  return <Badge className={statusTone(status)}>{status || "Unknown"}</Badge>;
}

function kpiTone(label: string) {
  switch (label) {
    case "Total Barang":
      return { iconWrap: "bg-blue-50 text-blue-700 border-blue-100" };
    case "Ready":
      return { iconWrap: "bg-green-50 text-green-700 border-green-100" };
    case "Disewa":
      return { iconWrap: "bg-purple-50 text-purple-700 border-purple-100" };
    case "Servis":
      return { iconWrap: "bg-amber-50 text-amber-800 border-amber-100" };
    case "Kalibrasi":
      return { iconWrap: "bg-sky-50 text-sky-700 border-sky-100" };
    case "Rusak":
      return { iconWrap: "bg-rose-50 text-rose-700 border-rose-100" };
    case "Hilang":
      return { iconWrap: "bg-rose-50 text-rose-700 border-rose-100" };
    default:
      return { iconWrap: "bg-muted text-foreground border-border" };
  }
}

function KpiCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  hint: string;
}) {
  const tone = kpiTone(label);
  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardDescription className="text-[13px]">{label}</CardDescription>
          <CardTitle className="text-3xl font-extrabold">{value}</CardTitle>
        </div>
        <div className={["grid h-10 w-10 place-items-center rounded-xl border", tone.iconWrap].join(" ")}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="text-sm font-semibold">{label}</div>
      {children}
    </div>
  );
}

export default function DataBarangPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // role
  const [role, setRole] = useState<string>("admin");
  useEffect(() => {
    setRole(localStorage.getItem("role") || "admin");
  }, []);
  const isAdmin = role === "admin";

  // list states
  const [loading, setLoading] = useState(false);
  const [paged, setPaged] = useState<PagedResponse<EquipmentRow> | null>(null);

  // filter states
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState(""); // ✅ penting: debounce dipisah
  const [status, setStatus] = useState<string>("all");
  const [classId, setClassId] = useState<string>("all");

  // pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // master data
  const [classes, setClasses] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // KPI GLOBAL
  const [kpiGlobal, setKpiGlobal] = useState<EquipmentStats>({
    total: 0,
    ready: 0,
    disewa: 0,
    servis: 0,
    kalibrasi: 0,
    rusak: 0,
    hilang: 0,
  });

  // dialogs
  const [openForm, setOpenForm] = useState(false);
  const [openMove, setOpenMove] = useState(false);

  // selected row
  const [selected, setSelected] = useState<EquipmentRow | null>(null);

  // form state
  const emptyForm = {
    equipment_code: "",
    equipment_name: "",
    class_id: "",
    serial_number: "",
    brand: "",
    model: "",
    condition_note: "",
    readiness_status: "Ready",
    current_slot_id: "",
  };
  const [form, setForm] = useState<any>(emptyForm);

  // move state
  const [mvWarehouseId, setMvWarehouseId] = useState<string>("");
  const [mvRacks, setMvRacks] = useState<any[]>([]);
  const [mvRackId, setMvRackId] = useState<string>("");
  const [mvSlots, setMvSlots] = useState<any[]>([]);
  const [mvSlotId, setMvSlotId] = useState<string>("");
  const [mvStatusAfter, setMvStatusAfter] = useState<string>("");
  const [mvDesc, setMvDesc] = useState<string>("");

  // URL integration
  const focusId = searchParams.get("focus"); // equipment_id
  const urlQ = searchParams.get("q");
  const urlClassId = searchParams.get("class_id");
  const urlStatus = searchParams.get("status");

  const didInitFromUrl = useRef(false);
  useEffect(() => {
    if (didInitFromUrl.current) return;
    didInitFromUrl.current = true;

    if (urlQ) setQ(urlQ);
    if (urlClassId) setClassId(urlClassId);
    if (urlStatus) setStatus(urlStatus);
    setPage(1);
  }, [urlQ, urlClassId, urlStatus]);

  // ✅ debounce q tanpa tergantung "load"
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  // ✅ reset page hanya ketika debounce q berubah (bener-bener user selesai ngetik)
  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const buildStatsQuery = useCallback(() => {
    return buildQuery({
      q: debouncedQ || undefined,
      status: status !== "all" ? status : undefined,
      class_id: classId !== "all" ? classId : undefined,
    });
  }, [debouncedQ, status, classId]);

  // guard biar response lama gak overwrite
  const reqSeq = useRef(0);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = !!opts?.silent;

      const mySeq = ++reqSeq.current;
      if (!silent) setLoading(true);

      try {
        const queryList = buildQuery({
          page,
          page_size: pageSize,
          q: debouncedQ || undefined,
          status: status !== "all" ? status : undefined,
          class_id: classId !== "all" ? classId : undefined,
        });

        const queryStats = buildStatsQuery();

        const [clsRaw, whRaw, resListRaw, resStats] = await Promise.all([
          apiGet<any[]>("/api/classes"),
          apiGet<any[]>("/api/warehouses"),
          apiGet<PagedResponse<EquipmentRow>>(`/api/equipment${queryList}`),
          apiGet<EquipmentStats>(`/api/equipment/stats${queryStats}`),
        ]);

        if (mySeq !== reqSeq.current) return;

        const cls = uniqueBy(clsRaw || [], (x: any) => String(x.class_id));
        const wh = uniqueBy(whRaw || [], (x: any) => String(x.warehouse_id));
        const resList = {
          ...resListRaw,
          rows: uniqueBy(resListRaw?.rows || [], (x: any) => String(x.equipment_id)),
        };

        setClasses(cls);
        setWarehouses(wh);
        setPaged(resList);

        setKpiGlobal({
          total: Number(resStats?.total ?? 0),
          ready: Number(resStats?.ready ?? 0),
          disewa: Number(resStats?.disewa ?? 0),
          servis: Number(resStats?.servis ?? 0),
          kalibrasi: Number(resStats?.kalibrasi ?? 0),
          rusak: Number(resStats?.rusak ?? 0),
          hilang: Number(resStats?.hilang ?? 0),
        });
      } catch (e: any) {
        if (mySeq !== reqSeq.current) return;

        console.error("LOAD DATABARANG ERROR:", e);
        setPaged({ page, page_size: pageSize, total: 0, total_pages: 1, rows: [] });
        setKpiGlobal({ total: 0, ready: 0, disewa: 0, servis: 0, kalibrasi: 0, rusak: 0, hilang: 0 });

        if (typeof window !== "undefined") {
          toast.error("Gagal memuat data", { description: e?.message || "Terjadi kesalahan" });
        }
      } finally {
        if (mySeq === reqSeq.current && !silent) setLoading(false);
      }
    },
    [page, pageSize, debouncedQ, status, classId, buildStatsQuery]
  );

  // ✅ load ketika page/pageSize/status/classId/debouncedQ berubah
  useEffect(() => {
    load();
  }, [page, pageSize, status, classId, debouncedQ, load]);

  const rows = paged?.rows || [];
  const total = paged?.total || 0;
  const totalPages = paged?.total_pages || 1;

  // focus row support
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const focused = focusId ? String(focusId) : "";
  useEffect(() => {
    if (!focused) return;
    const el = rowRefs.current[focused];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focused, rows]);

  function openAdd() {
    setSelected(null);
    setForm({ ...emptyForm, readiness_status: "Ready" });
    setOpenForm(true);
  }

  function openEdit(row: EquipmentRow) {
    setSelected(row);
    setForm({
      equipment_code: row.equipment_code || "",
      equipment_name: row.equipment_name || "",
      class_id: String(row.class_id || ""),
      serial_number: row.serial_number || "",
      brand: row.brand || "",
      model: row.model || "",
      condition_note: row.condition_note || "",
      readiness_status: row.readiness_status || "Ready",
      current_slot_id: row.current_slot_id ? String(row.current_slot_id) : "",
    });
    setOpenForm(true);
  }

  function openMoveDialog(row: EquipmentRow) {
    setSelected(row);
    setMvWarehouseId("");
    setMvRackId("");
    setMvSlotId("");
    setMvRacks([]);
    setMvSlots([]);
    setMvStatusAfter("");
    setMvDesc("");
    setOpenMove(true);
  }

  async function submitForm() {
    try {
      if (!isAdmin) {
        toast.error("Akses ditolak", { description: "Hanya admin yang bisa melakukan aksi ini." });
        return;
      }

      const payload = {
        equipment_code: form.equipment_code?.trim(),
        equipment_name: form.equipment_name?.trim(),
        class_id: Number(form.class_id),
        serial_number: form.serial_number?.trim() || null,
        brand: form.brand?.trim() || null,
        model: form.model?.trim() || null,
        condition_note: form.condition_note?.trim() || null,
        readiness_status: form.readiness_status || "Ready",
        current_slot_id: form.current_slot_id ? Number(form.current_slot_id) : null,
      };

      if (!payload.equipment_code || !payload.equipment_name || !payload.class_id) {
        toast.error("Validasi gagal", { description: "Kode, Nama, dan Kelas wajib diisi." });
        return;
      }

      if (selected?.equipment_id) {
        await apiPatch(`/api/equipment/${selected.equipment_id}`, payload);
        toast.success("Berhasil", { description: "Barang berhasil diperbarui." });
      } else {
        await apiPost(`/api/equipment`, payload);
        toast.success("Berhasil", { description: "Barang berhasil ditambahkan." });
      }

      setOpenForm(false);
      await load();
    } catch (e) {
      console.error("SUBMIT FORM ERROR:", e);
    }
  }

  async function deleteRow(row: EquipmentRow) {
    try {
      if (!isAdmin) {
        toast.error("Akses ditolak", { description: "Hanya admin yang bisa melakukan aksi ini." });
        return;
      }

      await apiDelete(`/api/equipment/${row.equipment_id}`);
      toast.success("Berhasil", { description: `Barang ${row.equipment_code} berhasil dihapus.` });
      await load();
    } catch (e) {
      console.error("DELETE ERROR:", e);
    }
  }

  async function loadRacks(warehouse_id: string) {
    if (!warehouse_id) return;
    const racksRaw = await apiGet<any[]>(`/api/racks${buildQuery({ warehouse_id })}`);
    const racks = uniqueBy(racksRaw || [], (x: any) => String(x.rack_id));
    setMvRacks(racks);
  }

  async function loadSlots(rack_id: string) {
    if (!rack_id) return;
    const slotsRaw = await apiGet<any[]>(`/api/slots${buildQuery({ rack_id })}`);
    const slots = uniqueBy(slotsRaw || [], (x: any) => String(x.slot_id));
    setMvSlots(slots);
  }

  async function submitMove() {
    try {
      if (!isAdmin) {
        toast.error("Akses ditolak", { description: "Hanya admin yang bisa melakukan aksi ini." });
        return;
      }
      if (!selected?.equipment_id) {
        toast.error("Data tidak valid", { description: "Barang tidak ditemukan." });
        return;
      }
      if (!mvSlotId) {
        toast.error("Validasi gagal", { description: "Pilih slot tujuan." });
        return;
      }

      await apiPost(`/api/placements`, {
        equipment_id: selected.equipment_id,
        to_slot_id: Number(mvSlotId),
        status_after: mvStatusAfter && mvStatusAfter !== "(none)" ? mvStatusAfter : null,
        description: mvDesc || null,
      });

      toast.success("Berhasil", { description: "Barang berhasil dipindahkan." });
      setOpenMove(false);
      await load();
      router.replace("/databarang");
    } catch (e) {
      console.error("MOVE ERROR:", e);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Data Barang</h1>
          <p className="text-sm text-muted-foreground">Kelola Barang dan Status Barang.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => load()} className="gap-2" disabled={loading}>
            <RefreshCcw className="h-4 w-4" />
            {loading ? "Memuat..." : "Refresh"}
          </Button>

          {isAdmin && (
            <Button onClick={openAdd} className="gap-2">
              <Boxes className="h-4 w-4" />
              Tambah Barang
            </Button>
          )}
        </div>
      </div>

      {/* KPI GLOBAL */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <KpiCard label="Total Barang" value={kpiGlobal.total} icon={<Package className="h-5 w-5" />} hint="Total equipment (sesuai filter saat ini)" />
        <KpiCard label="Ready" value={kpiGlobal.ready} icon={<CheckCircle2 className="h-5 w-5" />} hint="Siap digunakan" />
        <KpiCard label="Disewa" value={kpiGlobal.disewa} icon={<Handshake className="h-5 w-5" />} hint="Sedang keluar / digunakan" />
        <KpiCard label="Servis" value={kpiGlobal.servis} icon={<Wrench className="h-5 w-5" />} hint="Perlu servis / perbaikan" />
        <KpiCard label="Kalibrasi" value={kpiGlobal.kalibrasi} icon={<Ruler className="h-5 w-5" />} hint="Dalam proses kalibrasi" />
        <KpiCard label="Rusak" value={kpiGlobal.rusak ?? 0} icon={<XCircle className="h-5 w-5" />} hint="Tidak dapat digunakan" />
        <KpiCard label="Hilang" value={kpiGlobal.hilang ?? 0} icon={<Ban className="h-5 w-5" />} hint="Tidak ditemukan" />
      </section>

      {/* Filter + table */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>Daftar Barang</CardTitle>
              <CardDescription>
                {loading ? "Memuat..." : `Menampilkan halaman ${page} dari ${totalPages} • Total ${total} item`}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari kode / nama / serial / brand / model..."
                  className="w-[320px] max-w-[80vw] pl-9"
                />
              </div>

              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="status-all" value="all">Semua Status</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={`status-${s}`} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={classId} onValueChange={(v) => { setClassId(v); setPage(1); }}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue placeholder="Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="class-all" value="all">Semua Kelas</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={`class-${c.class_id}`} value={String(c.class_id)}>
                      {c.class_code} — {c.class_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue placeholder="Page" />
                </SelectTrigger>
                <SelectContent>
                  {[10, 12, 20, 50].map((n) => (
                    <SelectItem key={`ps-${n}`} value={String(n)}>
                      {n}/page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="rounded-xl border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Brand/Model</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((e: any) => {
                  const isFocused = focused && String(e.equipment_id) === focused;
                  const rowKey = `eq-${String(e.equipment_id)}`;

                  return (
                    <TableRow
                      key={rowKey}
                      ref={(el) => { rowRefs.current[String(e.equipment_id)] = el; }}
                      className={[
                        isFocused ? "bg-primary/10" : "",
                        isFocused ? "ring-1 ring-primary/30" : "",
                      ].join(" ")}
                    >
                      <TableCell className="font-mono">{e.equipment_code}</TableCell>
                      <TableCell className="font-semibold">{e.equipment_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {e.class_code} - {e.class_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={e.readiness_status} />
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">{e.serial_number || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {(e.brand || "-") + (e.model ? ` / ${e.model}` : "")}
                      </TableCell>
                      <TableCell className="font-mono">
                        {e.warehouse_code ? `${e.warehouse_code}/${e.rack_code}/${e.slot_code}` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <EquipmentRowActions
                          row={e}
                          isAdmin={isAdmin}
                          onEdit={openEdit}
                          onMove={openMoveDialog}
                          onDelete={deleteRow}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!loading && rows.length === 0 && (
                  <TableRow key="empty">
                    <TableCell colSpan={8}>
                      <div className="flex items-start gap-3 py-10">
                        <div className="grid h-10 w-10 place-items-center rounded-xl border bg-muted/30">
                          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-extrabold">Tidak ada data</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Coba ubah filter atau kata kunci pencarian.
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <div>
              Total <span className="font-semibold text-foreground">{total}</span> item • Page{" "}
              <span className="font-semibold text-foreground">{page}</span> /{" "}
              <span className="font-semibold text-foreground">{totalPages}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Prev
              </Button>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </Button>
            </div>
          </div>

          <Separator className="my-4" />
        </CardContent>
      </Card>

      {/* Dialog Tambah/Edit */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{selected ? "Edit Barang" : "Tambah Barang"}</DialogTitle>
            <DialogDesc>
              {selected ? "Perbarui data master barang." : "Tambahkan barang baru ke sistem."}
            </DialogDesc>
          </DialogHeader>

          {!isAdmin ? (
            <div className="rounded-xl border p-4 text-sm text-muted-foreground">
              Akses ditolak. Form Tambah/Edit hanya untuk Admin (sesuai backend saat ini).
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Kode Barang *">
                  <Input
                    value={form.equipment_code}
                    onChange={(e) => setForm((p: any) => ({ ...p, equipment_code: e.target.value }))}
                    placeholder="TS-001"
                  />
                </Field>

                <Field label="Nama Barang *">
                  <Input
                    value={form.equipment_name}
                    onChange={(e) => setForm((p: any) => ({ ...p, equipment_name: e.target.value }))}
                    placeholder="Total Station"
                  />
                </Field>

                <Field label="Kelas *">
                  <Select value={form.class_id} onValueChange={(v) => setForm((p: any) => ({ ...p, class_id: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={`form-class-${c.class_id}`} value={String(c.class_id)}>
                          {c.class_code} — {c.class_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Status">
                  <Select value={form.readiness_status} onValueChange={(v) => setForm((p: any) => ({ ...p, readiness_status: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={`form-status-${s}`} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Serial Number">
                  <Input
                    value={form.serial_number}
                    onChange={(e) => setForm((p: any) => ({ ...p, serial_number: e.target.value }))}
                    placeholder="SN-xxxx"
                  />
                </Field>

                <Field label="Brand">
                  <Input
                    value={form.brand}
                    onChange={(e) => setForm((p: any) => ({ ...p, brand: e.target.value }))}
                    placeholder="Topcon / Leica / ..."
                  />
                </Field>

                <Field label="Model">
                  <Input
                    value={form.model}
                    onChange={(e) => setForm((p: any) => ({ ...p, model: e.target.value }))}
                    placeholder="GM-52 / ..."
                  />
                </Field>

                <Field label="Slot Saat Ini (slot_id)">
                  <Input
                    value={form.current_slot_id}
                    onChange={(e) => setForm((p: any) => ({ ...p, current_slot_id: e.target.value }))}
                    placeholder="(opsional) contoh: 12"
                  />
                </Field>
              </div>

              <Field label="Catatan Kondisi">
                <Textarea
                  value={form.condition_note}
                  onChange={(e) => setForm((p: any) => ({ ...p, condition_note: e.target.value }))}
                  placeholder="Contoh: unit baik, minor scratch, perlu kalibrasi..."
                />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>Batal</Button>
            <Button onClick={submitForm} disabled={!isAdmin}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Pindahkan */}
      <Dialog open={openMove} onOpenChange={setOpenMove}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Pindahkan Barang</DialogTitle>
            <DialogDesc>
              Memindahkan barang ke slot lain dan otomatis tercatat di <code>placement_history</code>.
            </DialogDesc>
          </DialogHeader>

          {!isAdmin ? (
            <div className="rounded-xl border p-4 text-sm text-muted-foreground">
              Akses ditolak. Pemindahan hanya untuk Admin (sesuai backend saat ini).
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="rounded-xl border p-3">
                <div className="text-sm font-semibold">
                  {selected?.equipment_code} — {selected?.equipment_name}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Lokasi sekarang:{" "}
                  <span className="font-mono">
                    {selected?.warehouse_code ? `${selected.warehouse_code}/${selected.rack_code}/${selected.slot_code}` : "-"}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Gudang Tujuan">
                  <Select
                    value={mvWarehouseId}
                    onValueChange={async (v) => {
                      setMvWarehouseId(v);
                      setMvRackId("");
                      setMvSlotId("");
                      setMvRacks([]);
                      setMvSlots([]);
                      await loadRacks(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih gudang" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={`mv-wh-${w.warehouse_id}`} value={String(w.warehouse_id)}>
                          {w.warehouse_code} — {w.warehouse_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Rak Tujuan">
                  <Select
                    value={mvRackId}
                    onValueChange={async (v) => {
                      setMvRackId(v);
                      setMvSlotId("");
                      setMvSlots([]);
                      await loadSlots(v);
                    }}
                    disabled={!mvWarehouseId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!mvWarehouseId ? "Pilih gudang dulu" : "Pilih rak"} />
                    </SelectTrigger>
                    <SelectContent>
                      {mvRacks.map((r) => (
                        <SelectItem key={`mv-rack-${r.rack_id}`} value={String(r.rack_id)}>
                          {r.rack_code} {r.zone ? `(${r.zone})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Slot Tujuan">
                  <Select value={mvSlotId} onValueChange={setMvSlotId} disabled={!mvRackId}>
                    <SelectTrigger>
                      <SelectValue placeholder={!mvRackId ? "Pilih rak dulu" : "Pilih slot"} />
                    </SelectTrigger>
                    <SelectContent>
                      {mvSlots.map((s) => (
                        <SelectItem key={`mv-slot-${s.slot_id}`} value={String(s.slot_id)}>
                          {s.slot_code}
                          {s.equipment_id ? ` — TERISI (${s.equipment_code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="mt-2 text-xs text-muted-foreground">
                    * Kamu boleh pilih slot terisi, tapi sebaiknya slot kosong.
                  </div>
                </Field>

                <Field label="Ubah Status (opsional)">
                  <Select value={mvStatusAfter} onValueChange={setMvStatusAfter}>
                    <SelectTrigger>
                      <SelectValue placeholder="(tidak diubah)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem key="mv-status-none" value="(none)">Tidak diubah</SelectItem>
                      {STATUSES.map((s) => (
                        <SelectItem key={`mv-status-${s}`} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Catatan / Keterangan (opsional)">
                <Textarea
                  value={mvDesc}
                  onChange={(e) => setMvDesc(e.target.value)}
                  placeholder="Contoh: dipindahkan karena rak penuh / untuk kebutuhan pengambilan cepat..."
                />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenMove(false)}>Batal</Button>
            <Button onClick={submitMove} disabled={!isAdmin}>Simpan Penempatan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
