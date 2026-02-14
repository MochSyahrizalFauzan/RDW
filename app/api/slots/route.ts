import { NextRequest, NextResponse } from "next/server";
import { getDb, sql, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rackId = searchParams.get("rack_id");
    const warehouseId = searchParams.get("warehouse_id");
    const available = searchParams.get("available"); // "1" = only empty slots

    const db = getDb();

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (rackId) {
      conditions.push(`s.rack_id = $${paramIndex++}`);
      params.push(rackId);
    }
    if (warehouseId) {
      conditions.push(`r.warehouse_id = $${paramIndex++}`);
      params.push(warehouseId);
    }
    if (available === "1") {
      conditions.push(`s.equipment_id IS NULL`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await db.query(`
      SELECT s.*, r.rack_code, r.zone, w.warehouse_code, w.warehouse_name,
             e.equipment_id as eq_id, e.equipment_code, e.equipment_name
      FROM slots s 
      JOIN racks r ON r.rack_id = s.rack_id 
      JOIN warehouses w ON w.warehouse_id = r.warehouse_id 
      LEFT JOIN equipment e ON s.equipment_id = e.equipment_id
      ${whereClause}
      ORDER BY w.warehouse_code, r.rack_code, s.slot_code
    `, params);

    return NextResponse.json(result.rows, { headers: corsHeaders });
  } catch (e) {
    console.error("Slots GET error:", e);
    return NextResponse.json(
      { error: (e as Error).message }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { rack_id, slot_code, slot_label, notes } = body;

    if (!rack_id || !slot_code) {
      return NextResponse.json(
        { error: "rack_id and slot_code required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const db = getDb();
    const result = await db.query(
      sql(`
        INSERT INTO slots (rack_id, slot_code, slot_label, notes)
        VALUES (?, ?, ?, ?)
        RETURNING *
      `),
      [rack_id, slot_code, slot_label || null, notes || null]
    );

    return NextResponse.json(result.rows[0], { status: 201, headers: corsHeaders });
  } catch (e) {
    console.error("Slots POST error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
