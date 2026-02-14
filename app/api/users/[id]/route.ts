import { NextRequest, NextResponse } from "next/server";
import { getDb, sql, corsHeaders } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const result = await db.query(
      sql("SELECT user_id, username, full_name, role, is_active, created_at, last_login_at FROM users WHERE user_id = ?"),
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(result.rows[0], { headers: corsHeaders });
  } catch (e) {
    console.error("User GET error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.full_name !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(body.full_name);
    }
    if (body.role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      values.push(body.role);
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(body.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400, headers: corsHeaders }
      );
    }

    values.push(id);
    const db = getDb();
    const result = await db.query(
      `UPDATE users SET ${updates.join(", ")} WHERE user_id = $${paramIndex} RETURNING user_id, username, full_name, role, is_active`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(result.rows[0], { headers: corsHeaders });
  } catch (e) {
    console.error("User PATCH error:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
