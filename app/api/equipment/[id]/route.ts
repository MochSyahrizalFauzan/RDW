import { NextRequest, NextResponse } from "next/server";
import { getDb, sql, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const result = await db.query(
      sql(`
        SELECT e.*, c.class_code, c.class_name,
               s.slot_code, s.slot_label,
               r.rack_code, r.zone,
               w.warehouse_code, w.warehouse_name
        FROM equipment e
        LEFT JOIN equipment_classes c ON e.class_id = c.class_id
        LEFT JOIN slots s ON e.current_slot_id = s.slot_id
        LEFT JOIN racks r ON s.rack_id = r.rack_id
        LEFT JOIN warehouses w ON r.warehouse_id = w.warehouse_id
        WHERE e.equipment_id = ?
      `),
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Equipment not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(result.rows[0], { headers: corsHeaders });
  } catch (e) {
    console.error("Equipment GET error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = [
      "equipment_code", "equipment_name", "class_id", "serial_number",
      "brand", "model", "condition_note", "readiness_status", "current_slot_id"
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        values.push(body[field] === "" ? null : body[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400, headers: corsHeaders }
      );
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const db = getDb();
    const result = await db.query(
      `UPDATE equipment SET ${updates.join(", ")} WHERE equipment_id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Equipment not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(result.rows[0], { headers: corsHeaders });
  } catch (e) {
    console.error("Equipment PATCH error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    // Clear slot reference first
    await db.query(
      sql("UPDATE slots SET equipment_id = NULL WHERE equipment_id = ?"),
      [id]
    );

    const result = await db.query(
      sql("DELETE FROM equipment WHERE equipment_id = ? RETURNING equipment_id"),
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Equipment not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (e) {
    console.error("Equipment DELETE error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
