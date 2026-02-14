import { NextRequest, NextResponse } from "next/server";
import { getDb, sql, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get("warehouse_id");

    const db = getDb();
    let query = `
      SELECT r.*, w.warehouse_code, w.warehouse_name
      FROM racks r
      LEFT JOIN warehouses w ON r.warehouse_id = w.warehouse_id
    `;
    const params: any[] = [];

    if (warehouseId) {
      query += ` WHERE r.warehouse_id = $1`;
      params.push(warehouseId);
    }

    query += ` ORDER BY r.rack_code`;

    const result = await db.query(query, params);
    return NextResponse.json(result.rows, { headers: corsHeaders });
  } catch (e) {
    console.error("Racks GET error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { warehouse_id, rack_code, zone, capacity } = body;

    if (!warehouse_id || !rack_code) {
      return NextResponse.json(
        { error: "warehouse_id and rack_code required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const db = getDb();
    const result = await db.query(
      sql(`
        INSERT INTO racks (warehouse_id, rack_code, zone, capacity)
        VALUES (?, ?, ?, ?)
        RETURNING *
      `),
      [warehouse_id, rack_code, zone || null, capacity || null]
    );

    return NextResponse.json(result.rows[0], { status: 201, headers: corsHeaders });
  } catch (e) {
    console.error("Racks POST error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
