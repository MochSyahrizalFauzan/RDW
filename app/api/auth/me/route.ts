import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("session");
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ user: null }, { headers: corsHeaders });
    }

    const user = JSON.parse(sessionCookie.value);
    return NextResponse.json({ user }, { headers: corsHeaders });
  } catch {
    return NextResponse.json({ user: null }, { headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
