import { NextRequest, NextResponse } from "next/server";
import { getDb, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const classId = searchParams.get("class_id");
    const warehouseId = searchParams.get("warehouse_id");
    const performedBy = searchParams.get("performed_by");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("page_size") || "20", 10);

    const db = getDb();

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(e.equipment_code ILIKE $${paramIndex} OR e.equipment_name ILIKE $${paramIndex} OR h.description ILIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (classId) {
      conditions.push(`e.class_id = $${paramIndex++}`);
      params.push(classId);
    }
    if (warehouseId) {
      conditions.push(`(from_slot.warehouse_id = $${paramIndex} OR to_slot.warehouse_id = $${paramIndex})`);
      params.push(warehouseId);
      paramIndex++;
    }
    if (performedBy) {
      conditions.push(`h.performed_by = $${paramIndex++}`);
      params.push(performedBy);
    }
    if (dateFrom) {
      conditions.push(`h.created_at >= $${paramIndex++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`h.created_at <= $${paramIndex++}`);
      params.push(dateTo + " 23:59:59");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM placement_history h
      LEFT JOIN equipment e ON h.equipment_id = e.equipment_id
      LEFT JOIN slots from_slot ON h.from_slot_id = from_slot.slot_id
      LEFT JOIN slots to_slot ON h.to_slot_id = to_slot.slot_id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || "0", 10);

    // Get rows
    const offset = (page - 1) * pageSize;
    const dataQuery = `
      SELECT 
        h.history_id,
        h.created_at,
        h.description,
        h.status_before,
        h.status_after,
        h.equipment_id,
        e.equipment_code,
        e.equipment_name,
        e.serial_number,
        e.class_id,
        c.class_code,
        c.class_name,
        from_slot.slot_code as from_slot_code,
        from_rack.rack_code as from_rack_code,
        from_wh.warehouse_code as from_wh_code,
        from_wh.warehouse_name as from_wh_name,
        to_slot.slot_code as to_slot_code,
        to_rack.rack_code as to_rack_code,
        to_wh.warehouse_code as to_wh_code,
        to_wh.warehouse_name as to_wh_name,
        h.performed_by as performed_by_id,
        u.full_name as performed_by_name
      FROM placement_history h
      LEFT JOIN equipment e ON h.equipment_id = e.equipment_id
      LEFT JOIN classes c ON e.class_id = c.class_id
      LEFT JOIN slots from_slot ON h.from_slot_id = from_slot.slot_id
      LEFT JOIN racks from_rack ON from_slot.rack_id = from_rack.rack_id
      LEFT JOIN warehouses from_wh ON from_rack.warehouse_id = from_wh.warehouse_id
      LEFT JOIN slots to_slot ON h.to_slot_id = to_slot.slot_id
      LEFT JOIN racks to_rack ON to_slot.rack_id = to_rack.rack_id
      LEFT JOIN warehouses to_wh ON to_rack.warehouse_id = to_wh.warehouse_id
      LEFT JOIN users u ON h.performed_by = u.user_id
      ${whereClause}
      ORDER BY h.created_at DESC
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
    console.error("History GET error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
