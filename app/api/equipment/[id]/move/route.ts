import { NextRequest, NextResponse } from "next/server";
import { getDb, sql, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { to_slot_id, status_after, description, performed_by } = body;

    if (!to_slot_id) {
      return NextResponse.json(
        { error: "to_slot_id required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const db = getDb();

    // Get current equipment info
    const eqResult = await db.query(
      sql("SELECT * FROM equipment WHERE equipment_id = ?"),
      [id]
    );
    if (eqResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Equipment not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const equipment = eqResult.rows[0];
    const fromSlotId = equipment.current_slot_id;
    const statusBefore = equipment.readiness_status;
    const newStatus = status_after || statusBefore;

    // Check target slot exists
    const slotResult = await db.query(
      sql("SELECT * FROM slots WHERE slot_id = ?"),
      [to_slot_id]
    );
    if (slotResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Target slot not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if target slot is occupied by another equipment
    const occupiedResult = await db.query(
      sql("SELECT equipment_id FROM equipment WHERE current_slot_id = ? AND equipment_id != ?"),
      [to_slot_id, id]
    );
    if (occupiedResult.rows.length > 0) {
      return NextResponse.json(
        { error: "Target slot is occupied" },
        { status: 409, headers: corsHeaders }
      );
    }

    // Update equipment location and status
    await db.query(
      sql("UPDATE equipment SET current_slot_id = ?, readiness_status = ?, updated_at = NOW() WHERE equipment_id = ?"),
      [to_slot_id, newStatus, id]
    );

    // Record history
    await db.query(
      sql(`
        INSERT INTO placement_history 
        (equipment_id, from_slot_id, to_slot_id, status_before, status_after, description, performed_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
      [id, fromSlotId || null, to_slot_id, statusBefore, newStatus, description || null, performed_by || null]
    );

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (e) {
    console.error("Equipment move error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
