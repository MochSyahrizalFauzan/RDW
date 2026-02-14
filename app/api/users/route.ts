import { NextRequest, NextResponse } from "next/server";
import { getDb, sql, corsHeaders } from "@/lib/db";
import bcrypt from "bcrypt";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const result = await db.query(`
      SELECT user_id, username, full_name, role, is_active, created_at, last_login_at
      FROM users
      ORDER BY user_id
    `);
    return NextResponse.json(result.rows, { headers: corsHeaders });
  } catch (e) {
    console.error("Users GET error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { username, password, full_name, role, is_active } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "username and password required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const db = getDb();

    // Check if username exists
    const existing = await db.query(
      sql("SELECT user_id FROM users WHERE username = ?"),
      [username]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409, headers: corsHeaders }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      sql(`
        INSERT INTO users (username, password_hash, full_name, role, is_active)
        VALUES (?, ?, ?, ?, ?)
        RETURNING user_id, username, full_name, role, is_active, created_at
      `),
      [
        username,
        passwordHash,
        full_name || username,
        role || "frontdesk",
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201, headers: corsHeaders });
  } catch (e) {
    console.error("Users POST error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
