import { NextRequest, NextResponse } from "next/server";
import { getDb, sql, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

// Alias for /api/auth/me
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("session");
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ user: null }, { headers: corsHeaders });
    }

    const user = JSON.parse(sessionCookie.value);
    return NextResponse.json(user, { headers: corsHeaders });
  } catch {
    return NextResponse.json({ user: null }, { headers: corsHeaders });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("session");
    
    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401, headers: corsHeaders }
      );
    }

    const currentUser = JSON.parse(sessionCookie.value);
    const body = await request.json().catch(() => ({}));

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.full_name !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(body.full_name);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400, headers: corsHeaders }
      );
    }

    values.push(currentUser.user_id);
    const db = getDb();
    const result = await db.query(
      `UPDATE users SET ${updates.join(", ")} WHERE user_id = $${paramIndex} RETURNING user_id, username, full_name, role`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const updatedUser = result.rows[0];

    // Update session cookie
    const response = NextResponse.json(updatedUser, { headers: corsHeaders });
    response.cookies.set("session", JSON.stringify(updatedUser), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (e) {
    console.error("PATCH /api/me error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
