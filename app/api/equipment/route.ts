import { NextRequest, NextResponse } from "next/server";
import { getDb, sql, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status");
    const classId = searchParams.get("class_id");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("page_size") || "20", 10);

    const db = getDb();

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(e.equipment_code ILIKE $${paramIndex} OR e.equipment_name ILIKE $${paramIndex} OR e.serial_number ILIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (status) {
      conditions.push(`e.readiness_status = $${paramIndex++}`);
      params.push(status);
    }
    if (classId) {
      conditions.push(`e.class_id = $${paramIndex++}`);
      params.push(classId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count total
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM equipment e ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || "0", 10);

    // Get rows with joins
    const offset = (page - 1) * pageSize;
    const dataQuery = `
      SELECT 
        e.*,
        c.class_code,
        c.class_name,
        s.slot_code,
        s.slot_label,
        r.rack_code,
        r.zone,
        w.warehouse_code,
        w.warehouse_name
      FROM equipment e
      LEFT JOIN classes c ON e.class_id = c.class_id
      LEFT JOIN slots s ON e.current_slot_id = s.slot_id
      LEFT JOIN racks r ON s.rack_id = r.rack_id
      LEFT JOIN warehouses w ON r.warehouse_id = w.warehouse_id
      ${whereClause}
      ORDER BY e.equipment_id DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataParams = [...params, pageSize, offset];
    const dataResult = await db.query(dataQuery, dataParams);

    return NextResponse.json({
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
      rows: dataResult.rows,
    }, { headers: corsHeaders });
  } catch (e) {
    console.error("Equipment GET error:", e);
    return NextResponse.json(
      { error: (e as Error).message }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { 
      equipment_code, 
      equipment_name, 
      class_id,
      serial_number,
      brand,
      model,
      condition_note,
      readiness_status,
      current_slot_id 
    } = body;
    
    if (!equipment_code || !equipment_name || !class_id) {
      return NextResponse.json(
        { error: "equipment_code, equipment_name, and class_id required" }, 
        { status: 400, headers: corsHeaders }
      );
    }
    
    const db = getDb();
    const result = await db.query(
      sql(`INSERT INTO equipment (
        equipment_code, equipment_name, class_id, serial_number, 
        brand, model, condition_note, readiness_status, current_slot_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`),
      [
        equipment_code, 
        equipment_name, 
        class_id, 
        serial_number || null,
        brand || null,
        model || null,
        condition_note || null,
        readiness_status || "Ready",
        current_slot_id || null
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201, headers: corsHeaders });
  } catch (e) {
    console.error("Equipment POST error:", e);
    return NextResponse.json(
      { error: (e as Error).message }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
