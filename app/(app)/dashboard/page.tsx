"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

import {
  Boxes,
  Package,
  CheckCircle2,
  Warehouse as WarehouseIcon,
  AlertTriangle,
  Bell,
  RefreshCcw,
  Ruler,
} from "lucide-react";

import { apiGet } from "@/lib/api";

type DashboardResponse = {
  // masih ada di backend (tidak dipakai dashboard ini)
  kpi?: any;

  storage_kpi: {
    total_slots: number;
    occupied_slots: number;
    empty_slots: number;
    utilization_pct: number;
    racks_near_full: number;
  };

  utilization_by_warehouse: Array<{
    warehouse_id: number;
    warehouse_code: string;
    warehouse_name: string;
    total_slots: number;
    occupied_slots: number;
    utilization_pct: number | null;
  }>;

  alerts: {
    racks_near_full: Array<{
      warehouse_code: string;
      warehouse_name: string;
      rack_id: number;
      rack_code: string;
      zone: string | null;
      total_slots: number;
      occupied_slots: number;
      utilization_pct: number;
    }>;

    unavailable_breakdown: Array<{
      readiness_status: string;
      total: number;
    }>;

    calibration_list: Array<{
      equipment_id: number;
      equipment_code: string;
      equipment_name: string;
      readiness_status: string;
      updated_at: string | null;
      created_at: string;
    }>;
  };
};

function pctSafe(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function badgeLevel(pct: number) {
  if (pct >= 95) return { text: "Penuh", cls: "bg-red-600 hover:bg-red-600" };
  if (pct >= 85) return {
    text: "Hampir Penuh",
    cls: "bg-amber-600 hover:bg-amber-600",
  };
  return { text: "Tersedia", cls: "bg-green-600 hover:bg-green-600" };
}

function formatDt(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [storageKpi, setStorageKpi] = useState<DashboardResponse["storage_kpi"]>(
    {
      total_slots: 0,
      occupied_slots: 0,
      empty_slots: 0,
      utilization_pct: 0,
      racks_near_full: 0,
    }
  );

  const [util, setUtil] = useState<DashboardResponse["utilization_by_warehouse"]>(
    []
  );

  const [alerts, setAlerts] = useState<DashboardResponse["alerts"]>({
    racks_near_full: [],
    unavailable_breakdown: [],
    calibration_list: [],
  });

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const dash = await apiGet<DashboardResponse>("/api/dashboard");

      setStorageKpi(
        dash?.storage_kpi ?? {
          total_slots: 0,
          occupied_slots: 0,
          empty_slots: 0,
          utilization_pct: 0,
          racks_near_full: 0,
        }
      );

      setUtil(
        Array.isArray(dash?.utilization_by_warehouse)
          ? dash.utilization_by_warehouse
          : []
      );

      setAlerts(
        dash?.alerts ?? {
          racks_near_full: [],
          unavailable_breakdown: [],
          calibration_list: [],
        }
      );
    } catch (e: any) {
      setErrorMsg(e?.message || "Gagal memuat dashboard");
      setStorageKpi({
        total_slots: 0,
        occupied_slots: 0,
        empty_slots: 0,
        utilization_pct: 0,
        racks_near_full: 0,
      });
      setUtil([]);
      setAlerts({ racks_near_full: [], unavailable_breakdown: [], calibration_list: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const kpiCards = useMemo(
    () =>
      [
        {
          label: "Total Slot",
          value: storageKpi.total_slots,
          icon: Boxes,
          hint: "Total slot tersedia di semua gudang",
          tone: "bg-blue-50 text-blue-700 border-blue-100",
        },
        {
          label: "Slot Terpakai",
          value: storageKpi.occupied_slots,
          icon: Package,
          hint: "Slot yang sedang terisi equipment",
          tone: "bg-purple-50 text-purple-700 border-purple-100",
        },
        {
          label: "Slot Kosong",
          value: storageKpi.empty_slots,
          icon: CheckCircle2,
          hint: "Slot yang masih tersedia",
          tone: "bg-green-50 text-green-700 border-green-100",
        },
        {
          label: "Utilisasi",
          value: `${pctSafe(storageKpi.utilization_pct)}%`,
          icon: WarehouseIcon,
          hint: "Rata-rata pemakaian slot (global)",
          tone: "bg-sky-50 text-sky-700 border-sky-100",
        },
        {
          label: "Rak Hampir Penuh",
          value: storageKpi.racks_near_full,
          icon: AlertTriangle,
          hint: "Rak dengan utilisasi ≥ 80%",
          tone: "bg-amber-50 text-amber-800 border-amber-100",
        },
      ] as const,
    [storageKpi]
  );

  const systemStatus = useMemo(() => {
    const pct = pctSafe(storageKpi.utilization_pct);
    const level = badgeLevel(pct);
    return { pct, level };
  }, [storageKpi]);

  const hasAnyAlert =
    (alerts.racks_near_full?.length || 0) > 0 ||
    (alerts.unavailable_breakdown?.length || 0) > 0 ||
    (alerts.calibration_list?.length || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan penempatan barang • Utilisasi gudang & alert rak
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={load}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            {loading ? "Memuat..." : "Refresh"}
          </Button>
        </div>
      </div>

      {errorMsg ? (
        <Card className="rounded-2xl border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-base font-extrabold text-red-700">
              Gagal memuat data
            </CardTitle>
            <CardDescription className="text-red-700/80">
              {errorMsg}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={load} className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* KPI (Storage) */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {kpiCards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="rounded-2xl">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardDescription className="text-[13px]">
                    {c.label}
                  </CardDescription>
                  <CardTitle className="text-3xl font-extrabold">
                    {c.value}
                  </CardTitle>
                </div>
                <div
                  className={[
                    "grid h-10 w-10 place-items-center rounded-xl border",
                    c.tone,
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xs text-muted-foreground">{c.hint}</div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Main split */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Alerts */}
        <Card className="lg:col-span-2 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-extrabold">
                Alert / Notifikasi
              </CardTitle>
              <CardDescription>
                Rak hampir penuh • ringkasan non-ready • item kalibrasi
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" disabled>
              <Bell className="h-4 w-4" />
              Lihat Semua
            </Button>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* 1) Rack near full */}
            {alerts.racks_near_full?.slice(0, 4).map((r) => {
              const pct = pctSafe(r.utilization_pct);
              const level = badgeLevel(pct);
              const danger = pct >= 95;

              return (
                <div
                  key={r.rack_id}
                  className="flex items-start gap-3 rounded-2xl border p-4"
                >
                  <div
                    className={[
                      "grid h-10 w-10 place-items-center rounded-xl border",
                      danger
                        ? "bg-red-50 text-red-700 border-red-100"
                        : "bg-amber-50 text-amber-800 border-amber-100",
                    ].join(" ")}
                  >
                    <AlertTriangle className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold truncate">
                        Rak hampir penuh — {r.warehouse_code}/{r.rack_code}
                        {r.zone ? ` • ${r.zone}` : ""}
                      </div>
                      <Badge className={level.cls}>{level.text}</Badge>
                    </div>

                    <div className="mt-1 text-sm text-muted-foreground">
                      Terpakai {r.occupied_slots}/{r.total_slots} slot ({pct}%)
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 2) Unavailable breakdown (opsional) */}
            {alerts.unavailable_breakdown?.length ? (
              <div className="rounded-2xl border p-4">
                <div className="font-bold">Barang tidak tersedia (ringkasan)</div>
                <div className="text-sm text-muted-foreground">
                  Per status non-Ready
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {alerts.unavailable_breakdown.slice(0, 10).map((u, idx) => (
                    <Badge key={idx} variant="secondary">
                      {u.readiness_status}: {u.total}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {/* 3) Calibration list (opsional) */}
            {alerts.calibration_list?.length ? (
              <div className="rounded-2xl border p-4">
                <div className="flex items-center gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-xl border bg-sky-50 text-sky-700 border-sky-100">
                    <Ruler className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold">Item Kalibrasi (terbaru)</div>
                    <div className="text-sm text-muted-foreground">
                      Menampilkan 6 item terakhir
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {alerts.calibration_list.slice(0, 6).map((it) => (
                    <div
                      key={it.equipment_id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          <span className="text-xs text-muted-foreground mr-2">
                            {it.equipment_code}
                          </span>
                          {it.equipment_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Update: {formatDt(it.updated_at || it.created_at)}
                        </div>
                      </div>
                      <Badge variant="outline">Kalibrasi</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!hasAnyAlert ? (
              <div className="flex items-start gap-3 rounded-2xl border p-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl border bg-muted/30">
                  <Boxes className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">Tidak ada notifikasi kritis</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Sistem dalam kondisi normal.
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Utilization */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base font-extrabold">
              Utilisasi Kapasitas Gudang
            </CardTitle>
            <CardDescription>Terpakai berdasarkan slot tersedia</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {util.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Belum ada data gudang/slot.
              </div>
            ) : (
              util.slice(0, 6).map((u) => {
                const pct = pctSafe(u.utilization_pct);
                return (
                  <div key={u.warehouse_id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="grid h-8 w-8 place-items-center rounded-lg border bg-muted/30">
                          <WarehouseIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {u.warehouse_code} — {u.warehouse_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {u.occupied_slots}/{u.total_slots} slot
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">{pct}%</Badge>
                    </div>

                    <Progress value={pct} />

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Terpakai: {u.occupied_slots}</span>
                      <span>
                        Sisa:{" "}
                        {Math.max(
                          0,
                          Number(u.total_slots || 0) - Number(u.occupied_slots || 0)
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Status Sistem</div>
              <Badge className={systemStatus.level.cls}>{systemStatus.level.text}</Badge>
            </div>

            <div className="text-xs text-muted-foreground">
              Utilisasi global:{" "}
              <span className="font-semibold">
                {pctSafe(storageKpi.utilization_pct)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
