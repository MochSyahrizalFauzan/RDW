import { NextResponse } from "next/server";
import { corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ 
    ok: true, 
    message: "pong",
    timestamp: new Date().toISOString()
  }, { headers: corsHeaders });
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
