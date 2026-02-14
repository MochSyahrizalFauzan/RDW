import { NextResponse } from "next/server";
import { getDb, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const result = await db.query(`
      SELECT s.*, r.rack_code, w.warehouse_code 
      FROM slots s 
      JOIN racks r ON r.rack_id = s.rack_id 
      JOIN warehouses w ON w.warehouse_id = r.warehouse_id 
      ORDER BY w.warehouse_code, r.rack_code, s.slot_code
    `);
    return NextResponse.json(result.rows, { headers: corsHeaders });
  } catch (e) {
    console.error("Slots error:", e);
    return NextResponse.json(
      { error: (e as Error).message }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
