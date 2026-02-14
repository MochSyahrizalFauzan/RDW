import { NextResponse } from "next/server";
import { getDb, corsHeaders } from "@/lib/db";

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

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
