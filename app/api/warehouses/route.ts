import { NextRequest, NextResponse } from "next/server";
import { getDb, sql, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const result = await db.query("SELECT * FROM warehouses ORDER BY warehouse_code");
    return NextResponse.json(result.rows, { headers: corsHeaders });
  } catch (e) {
    console.error("Warehouses error:", e);
    return NextResponse.json(
      { error: (e as Error).message }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { warehouse_code, warehouse_name } = body;
    
    if (!warehouse_code || !warehouse_name) {
      return NextResponse.json(
        { error: "Invalid input" }, 
        { status: 400, headers: corsHeaders }
      );
    }
    
    const db = getDb();
    await db.query(
      sql("INSERT INTO warehouses (warehouse_code, warehouse_name) VALUES (?, ?)"),
      [warehouse_code, warehouse_name]
    );
    return NextResponse.json({ ok: true }, { status: 201, headers: corsHeaders });
  } catch (e) {
    console.error("Warehouse create error:", e);
    return NextResponse.json(
      { error: (e as Error).message }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
