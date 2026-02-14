import { NextResponse } from "next/server";
import { corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({ ok: true }, { headers: corsHeaders });
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
