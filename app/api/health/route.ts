import { NextResponse } from "next/server";
import { getDb, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const result = await db.query("SELECT NOW() as time, 1 as status");
    return NextResponse.json({ 
      ok: true, 
      time: result.rows[0].time,
      database: "connected"
    }, { headers: corsHeaders });
  } catch (e) {
    console.error("Health check failed:", e);
    return NextResponse.json({ 
      ok: false, 
      error: (e as Error).message,
      database: "disconnected"
    }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
