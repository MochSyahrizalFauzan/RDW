import { NextRequest, NextResponse } from "next/server";
import { getDb, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status");
    const classId = searchParams.get("class_id");

    const db = getDb();

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(equipment_code ILIKE $${paramIndex} OR equipment_name ILIKE $${paramIndex} OR serial_number ILIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (status) {
      conditions.push(`readiness_status = $${paramIndex++}`);
      params.push(status);
    }
    if (classId) {
      conditions.push(`class_id = $${paramIndex++}`);
      params.push(classId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

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
      ${whereClause}
    `, params);

    const row = result.rows[0] || {};
    return NextResponse.json({
      total: parseInt(row.total || "0"),
      ready: parseInt(row.ready || "0"),
      disewa: parseInt(row.disewa || "0"),
      servis: parseInt(row.servis || "0"),
      kalibrasi: parseInt(row.kalibrasi || "0"),
      rusak: parseInt(row.rusak || "0"),
      hilang: parseInt(row.hilang || "0"),
    }, { headers: corsHeaders });
  } catch (e) {
    console.error("Equipment stats error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
