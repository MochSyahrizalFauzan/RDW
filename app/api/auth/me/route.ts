import { NextResponse } from "next/server";
import { corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  // In a real app, check session/JWT here
  return NextResponse.json({ user: null }, { headers: corsHeaders });
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
