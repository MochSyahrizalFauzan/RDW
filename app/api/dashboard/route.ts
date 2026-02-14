import { NextResponse } from "next/server";
import { getDb, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();

    // 1. Storage KPI - slot utilization (join with equipment via current_slot_id)
    const storageKpi = await db.query(`
      SELECT 
        COUNT(s.slot_id) AS total_slots,
        COUNT(e.equipment_id) AS occupied_slots,
        COUNT(s.slot_id) - COUNT(e.equipment_id) AS empty_slots
      FROM slots s
      LEFT JOIN equipment e ON s.slot_id = e.current_slot_id
    `);
    const skpi = storageKpi.rows[0] || { total_slots: 0, occupied_slots: 0, empty_slots: 0 };
    const totalSlots = parseInt(skpi.total_slots || "0");
    const occupiedSlots = parseInt(skpi.occupied_slots || "0");
    const emptySlots = parseInt(skpi.empty_slots || "0");
    const utilizationPct = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;

    // 2. Racks near full (>= 85% utilization)
    const racksNearFull = await db.query(`
      SELECT 
        w.warehouse_code,
        w.warehouse_name,
        r.rack_id,
        r.rack_code,
        r.zone,
        COUNT(s.slot_id) AS total_slots,
        COUNT(e.equipment_id) AS occupied_slots
      FROM racks r
      JOIN warehouses w ON r.warehouse_id = w.warehouse_id
      LEFT JOIN slots s ON r.rack_id = s.rack_id
      LEFT JOIN equipment e ON s.slot_id = e.current_slot_id
      GROUP BY w.warehouse_code, w.warehouse_name, r.rack_id, r.rack_code, r.zone
      HAVING COUNT(s.slot_id) > 0 
        AND (COUNT(e.equipment_id)::float / COUNT(s.slot_id)::float) >= 0.85
      ORDER BY (COUNT(e.equipment_id)::float / COUNT(s.slot_id)::float) DESC
    `);

    const racksNearFullData = racksNearFull.rows.map((r: any) => ({
      ...r,
      total_slots: parseInt(r.total_slots),
      occupied_slots: parseInt(r.occupied_slots),
      utilization_pct: Math.round((parseInt(r.occupied_slots) / parseInt(r.total_slots)) * 100),
    }));

    // 3. Utilization by warehouse
    const warehouseUtil = await db.query(`
      SELECT 
        w.warehouse_id,
        w.warehouse_code,
        w.warehouse_name,
        COUNT(s.slot_id) AS total_slots,
        COUNT(e.equipment_id) AS occupied_slots
      FROM warehouses w
      LEFT JOIN racks r ON w.warehouse_id = r.warehouse_id
      LEFT JOIN slots s ON r.rack_id = s.rack_id
      LEFT JOIN equipment e ON s.slot_id = e.current_slot_id
      GROUP BY w.warehouse_id, w.warehouse_code, w.warehouse_name
      ORDER BY w.warehouse_code
    `);

    const utilizationByWarehouse = warehouseUtil.rows.map((r: any) => ({
      warehouse_id: r.warehouse_id,
      warehouse_code: r.warehouse_code,
      warehouse_name: r.warehouse_name,
      total_slots: parseInt(r.total_slots || "0"),
      occupied_slots: parseInt(r.occupied_slots || "0"),
      utilization_pct: parseInt(r.total_slots || "0") > 0
        ? Math.round((parseInt(r.occupied_slots || "0") / parseInt(r.total_slots)) * 100)
        : null,
    }));

    // 4. Equipment status breakdown (unavailable)
    const unavailableBreakdown = await db.query(`
      SELECT readiness_status, COUNT(*) AS total
      FROM equipment
      WHERE readiness_status NOT IN ('Ready')
      GROUP BY readiness_status
      ORDER BY total DESC
    `);

    // 5. Calibration list (equipment in Kalibrasi status)
    const calibrationList = await db.query(`
      SELECT equipment_id, equipment_code, equipment_name, readiness_status, updated_at, created_at
      FROM equipment
      WHERE readiness_status = 'Kalibrasi'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    return NextResponse.json({
      storage_kpi: {
        total_slots: totalSlots,
        occupied_slots: occupiedSlots,
        empty_slots: emptySlots,
        utilization_pct: utilizationPct,
        racks_near_full: racksNearFullData.length,
      },
      utilization_by_warehouse: utilizationByWarehouse,
      alerts: {
        racks_near_full: racksNearFullData,
        unavailable_breakdown: unavailableBreakdown.rows.map((r: any) => ({
          readiness_status: r.readiness_status,
          total: parseInt(r.total),
        })),
        calibration_list: calibrationList.rows,
      },
    }, { headers: corsHeaders });
  } catch (e) {
    console.error("Dashboard error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
