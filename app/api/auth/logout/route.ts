import { NextResponse } from "next/server";
import { corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { headers: corsHeaders });
  
  // Clear session cookie
  response.cookies.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // Expire immediately
  });
  
  return response;
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
