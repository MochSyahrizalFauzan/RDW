"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { History, RefreshCw, ChevronLeft, ChevronRight, FileText, Download } from "lucide-react";

type ClassRow = { class_id: number; class_code: string; class_name: string };
type WhRow = { warehouse_id: number; warehouse_code: string; warehouse_name: string };
type UserRow = { user_id: number; full_name: string };

type HistoryRow = {
  history_id: number;
  created_at: string;
  description: string | null;
  status_before: string | null;
  status_after: string | null;

  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  serial_number: string | null;

  class_id: number;
  class_code: string;
  class_name: string;

  from_slot_code: string | null;
  from_rack_code: string | null;
  from_wh_code: string | null;
  from_wh_name: string | null;

  to_slot_code: string | null;
  to_rack_code: string | null;
  to_wh_code: string | null;
  to_wh_name: string | null;

  performed_by_id: number | null;
  performed_by_name: string | null;
};

type HistoryResponse = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  rows: HistoryRow[];
};

function fmtDateTime(v?: string | null) {
  if (!v) return "-";
  return String(v).replace("T", " ").slice(0, 19);
}

function statusColor(v?: string | null) {
  const s = String(v || "");
  switch (s) {
    case "Ready":
      return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
    case "Disewa":
      return "bg-sky-100 text-sky-800 hover:bg-sky-100";
    case "Servis":
      return "bg-amber-100 text-amber-800 hover:bg-amber-100";
    case "Kalibrasi":
      return "bg-purple-100 text-purple-800 hover:bg-purple-100";
    case "Rusak":
      return "bg-rose-100 text-rose-800 hover:bg-rose-100";
    case "Hilang":
      return "bg-zinc-200 text-zinc-900 hover:bg-zinc-200";
    default:
      return "bg-muted text-foreground hover:bg-muted";
  }
}

function toCsv(rows: any[], headers: { key: string; label: string }[]) {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    const q = s.replaceAll(`"`, `""`);
    return `"${q}"`;
  };
  const head = headers.map((h) => esc(h.label)).join(",");
  const body = rows
    .map((r) => headers.map((h) => esc(r[h.key])).join(","))
    .join("\n");
  return head + "\n" + body;
}

function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function RiwayatDanLaporanPage() {
  const [tab, setTab] = useState<"riwayat" | "laporan">("riwayat");
  const [loading, setLoading] = useState(false);

  // filters
  const [q, setQ] = useState("");
  const [classId, setClassId] = useState<string>("all");
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [performedBy, setPerformedBy] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // master data
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [warehouses, setWarehouses] = useState<WhRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  // data
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HistoryResponse>({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 1,
    rows: [],
  });

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (classId !== "all") p.set("class_id", classId);
    if (warehouseId !== "all") p.set("warehouse_id", warehouseId);
    if (performedBy !== "all") p.set("performed_by", performedBy);
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);
    p.set("page", String(page));
    p.set("page_size", "20");
    return p.toString();
  }, [q, classId, warehouseId, performedBy, dateFrom, dateTo, page]);

  async function loadMasters() {
    try {
      const [c, w, u] = await Promise.all([
        apiGet<ClassRow[]>("/api/classes"),
        apiGet<WhRow[]>("/api/warehouses"),
        apiGet<UserRow[]>("/api/users").catch(() => [] as UserRow[]),
      ]);
      setClasses(c);
      setWarehouses(w);
      setUsers(u);
    } catch (e) {
      console.error("LOAD MASTER ERROR:", e);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await apiGet<HistoryResponse>(`/api/history?${queryString}`);
      setData(res);
    } catch (e) {
      console.error("LOAD HISTORY ERROR:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  function resetFilters() {
    setQ("");
    setClassId("all");
    setWarehouseId("all");
    setPerformedBy("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  // ===== Laporan (rekap dari data.rows yang sedang tampil) =====
  const report = useMemo(() => {
    const rows = data.rows;

    const byWh = new Map<string, { wh: string; total: number }>();
    const byClass = new Map<string, { cls: string; total: number }>();
    const byStatusTo = new Map<string, { status: string; total: number }>();

    for (const r of rows) {
      const wh = r.to_wh_code ? `${r.to_wh_code} — ${r.to_wh_name || ""}`.trim() : "Tidak diketahui";
      const cls = r.class_code ? `${r.class_code} — ${r.class_name || ""}`.trim() : "Tidak diketahui";
      const st = r.status_after || "Tidak diketahui";

      byWh.set(wh, { wh, total: (byWh.get(wh)?.total || 0) + 1 });
      byClass.set(cls, { cls, total: (byClass.get(cls)?.total || 0) + 1 });
      byStatusTo.set(st, { status: st, total: (byStatusTo.get(st)?.total || 0) + 1 });
    }

    const sortDesc = <T extends { total: number }>(a: T, b: T) => b.total - a.total;

    return {
      byWarehouse: Array.from(byWh.values()).sort(sortDesc),
      byClass: Array.from(byClass.values()).sort(sortDesc),
      byStatusAfter: Array.from(byStatusTo.values()).sort(sortDesc),
      sampleSize: rows.length,
    };
  }, [data.rows]);

  function exportRiwayatCSV() {
    const rows = data.rows.map((r) => ({
      waktu: fmtDateTime(r.created_at),
      equipment_code: r.equipment_code,
      equipment_name: r.equipment_name,
      serial_number: r.serial_number || "",
      class: `${r.class_code} - ${r.class_name}`,
      dari: `${r.from_wh_code || "-"} / ${r.from_rack_code || "-"} / ${r.from_slot_code || "-"}`,
      ke: `${r.to_wh_code || "-"} / ${r.to_rack_code || "-"} / ${r.to_slot_code || "-"}`,
      status_before: r.status_before || "",
      status_after: r.status_after || "",
      pelaku: r.performed_by_name || "",
      catatan: r.description || "",
    }));

    const csv = toCsv(rows, [
      { key: "waktu", label: "Waktu" },
      { key: "equipment_code", label: "Kode" },
      { key: "equipment_name", label: "Nama" },
      { key: "serial_number", label: "Serial Number" },
      { key: "class", label: "Kelas" },
      { key: "dari", label: "Dari (WH/Rak/Slot)" },
      { key: "ke", label: "Ke (WH/Rak/Slot)" },
      { key: "status_before", label: "Status Sebelum" },
      { key: "status_after", label: "Status Sesudah" },
      { key: "pelaku", label: "Pelaku" },
      { key: "catatan", label: "Catatan" },
    ]);

    downloadText(`riwayat-penempatan-page${data.page}.csv`, csv);
  }

  function exportLaporanCSV() {
    const rows = [
      ...report.byWarehouse.map((x) => ({ kategori: "Gudang Tujuan", nama: x.wh, total: x.total })),
      ...report.byClass.map((x) => ({ kategori: "Kelas", nama: x.cls, total: x.total })),
      ...report.byStatusAfter.map((x) => ({ kategori: "Status Sesudah", nama: x.status, total: x.total })),
    ];
    const csv = toCsv(rows, [
      { key: "kategori", label: "Kategori" },
      { key: "nama", label: "Nama" },
      { key: "total", label: "Total" },
    ]);
    downloadText(`laporan-penempatan-page${data.page}.csv`, csv);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <History className="h-5 w-5" />
            Riwayat & Laporan Penempatan
          </h1>
          <p className="text-sm text-muted-foreground">
            Riwayat pemindahan/penempatan alat dan rekap laporan dari data <code>placement_history</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={resetFilters} disabled={loading}>
            Reset Filter
          </Button>

          {tab === "riwayat" ? (
            <Button onClick={exportRiwayatCSV} disabled={loading} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          ) : (
            <Button onClick={exportLaporanCSV} disabled={loading} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>Filter berlaku untuk tab Riwayat maupun Laporan.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Row 1 */}
          <div className="grid gap-3 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Pencarian</label>
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Kode / Nama / SN / Catatan / Pelaku"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Kelas</label>
              <Select
                value={classId}
                onValueChange={(v) => {
                  setClassId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.class_id} value={String(c.class_id)}>
                      {c.class_code} — {c.class_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Gudang</label>
              <Select
                value={warehouseId}
                onValueChange={(v) => {
                  setWarehouseId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua gudang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.warehouse_id} value={String(w.warehouse_id)}>
                      {w.warehouse_code} — {w.warehouse_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Pelaku</label>
              <Select
                value={performedBy}
                onValueChange={(v) => {
                  setPerformedBy(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.user_id} value={String(u.user_id)}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Dari Tanggal</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Sampai Tanggal</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="sm:col-span-2 flex items-end justify-between gap-2 rounded-xl border bg-muted/10 px-3 py-2">
              <div className="text-xs text-muted-foreground">
                Menampilkan <span className="font-semibold text-foreground">{data.rows.length}</span> baris (halaman ini)
                dari total <span className="font-semibold text-foreground">{data.total}</span>.
              </div>
              <Badge variant="secondary" className="whitespace-nowrap">
                Page {data.page} / {data.total_pages}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="riwayat" className="gap-2">
            <History className="h-4 w-4" /> Riwayat
          </TabsTrigger>
          <TabsTrigger value="laporan" className="gap-2">
            <FileText className="h-4 w-4" /> Laporan
          </TabsTrigger>
        </TabsList>

        {/* ===== RIWAYAT ===== */}
        <TabsContent value="riwayat" className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Data Riwayat</CardTitle>
                  <CardDescription>Log detail pemindahan / penempatan alat.</CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={loading || page <= 1}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                    disabled={loading || page >= data.total_pages}
                    className="gap-1"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="rounded-xl border overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr className="text-left">
                      <th className="px-3 py-2 whitespace-nowrap">Waktu</th>
                      <th className="px-3 py-2">Equipment</th>
                      <th className="px-3 py-2">Kelas</th>
                      <th className="px-3 py-2 whitespace-nowrap">Dari</th>
                      <th className="px-3 py-2 whitespace-nowrap">Ke</th>
                      <th className="px-3 py-2 whitespace-nowrap">Status</th>
                      <th className="px-3 py-2 whitespace-nowrap">Pelaku</th>
                      <th className="px-3 py-2">Catatan</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.history_id} className="border-t align-top">
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                          {fmtDateTime(r.created_at)}
                        </td>

                        <td className="px-3 py-2">
                          <div className="font-semibold">{r.equipment_code}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.equipment_name}
                            {r.serial_number ? ` · SN: ${r.serial_number}` : ""}
                          </div>
                        </td>

                        <td className="px-3 py-2">
                          <div className="font-semibold">{r.class_code}</div>
                          <div className="text-xs text-muted-foreground">{r.class_name}</div>
                        </td>

                        <td className="px-3 py-2">
                          <div className="text-xs text-muted-foreground">
                            {(r.from_wh_code || "-") + (r.from_rack_code ? ` · ${r.from_rack_code}` : "") + (r.from_slot_code ? ` · ${r.from_slot_code}` : "")}
                          </div>
                        </td>

                        <td className="px-3 py-2">
                          <div className="text-xs text-muted-foreground">
                            {(r.to_wh_code || "-") + (r.to_rack_code ? ` · ${r.to_rack_code}` : "") + (r.to_slot_code ? ` · ${r.to_slot_code}` : "")}
                          </div>
                        </td>

                        {/* STATUS RAPI */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1 text-xs">
                            <Badge className={`px-2 py-0.5 rounded-md ${statusColor(r.status_before)}`}>
                              {r.status_before || "-"}
                            </Badge>
                            <span className="text-muted-foreground">→</span>
                            <Badge className={`px-2 py-0.5 rounded-md ${statusColor(r.status_after)}`}>
                              {r.status_after || "-"}
                            </Badge>
                          </div>
                        </td>

                        <td className="px-3 py-2">
                          <div className="text-sm">{r.performed_by_name || "-"}</div>
                        </td>

                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {r.description || "-"}
                        </td>
                      </tr>
                    ))}

                    {data.rows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                          Tidak ada data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <Separator className="my-4" />
              <div className="text-xs text-muted-foreground">
                Sumber data: <code>placement_history</code> (join equipment/classes/warehouses/users).
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== LAPORAN ===== */}
        <TabsContent value="laporan" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Rekap Gudang Tujuan</CardTitle>
                <CardDescription className="text-xs">
                  Berdasarkan data halaman ini ({report.sampleSize} baris).
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-xl border overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-3 py-2 text-left">Gudang</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byWarehouse.map((x) => (
                        <tr key={x.wh} className="border-t">
                          <td className="px-3 py-2 text-xs">{x.wh}</td>
                          <td className="px-3 py-2 text-right font-semibold">{x.total}</td>
                        </tr>
                      ))}
                      {report.byWarehouse.length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">
                            Tidak ada data.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Rekap Kelas</CardTitle>
                <CardDescription className="text-xs">
                  Berdasarkan data halaman ini ({report.sampleSize} baris).
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-xl border overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-3 py-2 text-left">Kelas</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byClass.map((x) => (
                        <tr key={x.cls} className="border-t">
                          <td className="px-3 py-2 text-xs">{x.cls}</td>
                          <td className="px-3 py-2 text-right font-semibold">{x.total}</td>
                        </tr>
                      ))}
                      {report.byClass.length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">
                            Tidak ada data.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Rekap Status Sesudah</CardTitle>
                <CardDescription className="text-xs">
                  Berdasarkan data halaman ini ({report.sampleSize} baris).
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-xl border overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byStatusAfter.map((x) => (
                        <tr key={x.status} className="border-t">
                          <td className="px-3 py-2">
                            <Badge className={`px-2 py-0.5 rounded-md ${statusColor(x.status)}`}>
                              {x.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">{x.total}</td>
                        </tr>
                      ))}
                      {report.byStatusAfter.length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">
                            Tidak ada data.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 text-xs text-muted-foreground">
                  * Untuk laporan global (semua data), lebih bagus dibuat endpoint report di backend (biar tidak terbatas pagination).
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
