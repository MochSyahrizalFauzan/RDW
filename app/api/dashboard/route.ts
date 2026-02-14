import { NextResponse } from "next/server";
import { getDb, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const result = await db.query(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN readiness_status='Ready' THEN 1 ELSE 0 END) AS ready,
        SUM(CASE WHEN readiness_status='Disewa' THEN 1 ELSE 0 END) AS disewa,
        SUM(CASE WHEN readiness_status='Servis' THEN 1 ELSE 0 END) AS servis,
        SUM(CASE WHEN readiness_status='Kalibrasi' THEN 1 ELSE 0 END) AS kalibrasi,
        SUM(CASE WHEN readiness_status='Rusak' THEN 1 ELSE 0 END) AS rusak,
        SUM(CASE WHEN readiness_status='Hilang' THEN 1 ELSE 0 END) AS hilang
      FROM equipment
    `);
    return NextResponse.json(result.rows[0] || {}, { headers: corsHeaders });
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
