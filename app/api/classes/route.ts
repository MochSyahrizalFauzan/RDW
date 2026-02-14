import { NextRequest, NextResponse } from "next/server";
import { getDb, sql, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const result = await db.query("SELECT * FROM classes ORDER BY class_code");
    return NextResponse.json(result.rows, { headers: corsHeaders });
  } catch (e) {
    console.error("Classes error:", e);
    return NextResponse.json(
      { error: (e as Error).message }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { class_code, class_name, description } = body;

    if (!class_code || !class_name) {
      return NextResponse.json(
        { error: "class_code and class_name required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const db = getDb();
    const result = await db.query(
      sql(`
        INSERT INTO classes (class_code, class_name, description)
        VALUES (?, ?, ?)
        RETURNING *
      `),
      [class_code, class_name, description || null]
    );

    return NextResponse.json(result.rows[0], { status: 201, headers: corsHeaders });
  } catch (e) {
    console.error("Classes POST error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
