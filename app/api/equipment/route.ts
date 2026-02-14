import { NextRequest, NextResponse } from "next/server";
import { getDb, sql, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const result = await db.query(
      "SELECT * FROM equipment ORDER BY equipment_id DESC LIMIT 50"
    );
    return NextResponse.json(result.rows, { headers: corsHeaders });
  } catch (e) {
    console.error("Equipment error:", e);
    return NextResponse.json(
      { error: (e as Error).message }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { equipment_code, equipment_name, class_id } = body;
    
    if (!equipment_code || !equipment_name || !class_id) {
      return NextResponse.json(
        { error: "Invalid input" }, 
        { status: 400, headers: corsHeaders }
      );
    }
    
    const db = getDb();
    await db.query(
      sql(`INSERT INTO equipment (equipment_code, equipment_name, class_id, readiness_status)
           VALUES (?, ?, ?, ?)`),
      [equipment_code, equipment_name, class_id, "Ready"]
    );
    return NextResponse.json({ ok: true }, { status: 201, headers: corsHeaders });
  } catch (e) {
    console.error("Equipment create error:", e);
    return NextResponse.json(
      { error: (e as Error).message }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
