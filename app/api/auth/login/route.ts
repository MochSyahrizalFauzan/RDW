import { NextRequest, NextResponse } from "next/server";
import { getDb, sql, corsHeaders } from "@/lib/db";
import bcrypt from "bcrypt";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { username, password } = body;
    
    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password required" }, 
        { status: 400, headers: corsHeaders }
      );
    }

    const db = getDb();
    const result = await db.query(
      sql("SELECT * FROM users WHERE username = ?"), 
      [username]
    );
    const user = result.rows[0];

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" }, 
        { status: 401, headers: corsHeaders }
      );
    }
    
    if (!user.is_active) {
      return NextResponse.json(
        { error: "Account inactive" }, 
        { status: 403, headers: corsHeaders }
      );
    }

    // Check password - support both bcrypt hashed and plain text
    const match = user.password_hash?.startsWith("$2")
      ? await bcrypt.compare(password, user.password_hash)
      : password === user.password_hash;

    if (!match) {
      return NextResponse.json(
        { error: "Invalid credentials" }, 
        { status: 401, headers: corsHeaders }
      );
    }

    // Update last login
    await db.query(
      sql("UPDATE users SET last_login_at = NOW() WHERE user_id = ?"), 
      [user.user_id]
    );

    const userData = {
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    };

    // Create response with session cookie
    const response = NextResponse.json({ user: userData }, { headers: corsHeaders });
    
    // Set session cookie (httpOnly for security)
    response.cookies.set("session", JSON.stringify(userData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json(
      { error: "Server error" }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
