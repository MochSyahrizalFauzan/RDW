import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import bcrypt from "bcrypt";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Database connection - lazy initialization
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      max: 3,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

// Helper: Convert MySQL ? to PostgreSQL $n
function sql(query: string): string {
  let i = 0;
  return query.replace(/\?/g, () => `$${++i}`);
}

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET handler
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const route = "/" + path.join("/");

  try {
    // Simple ping (no DB)
    if (route === "/ping") {
      return NextResponse.json({ ok: true, route }, { headers: corsHeaders });
    }

    // Health check with DB
    if (route === "/health") {
      const db = getPool();
      const result = await db.query("SELECT NOW()");
      return NextResponse.json({ ok: true, time: result.rows[0] }, { headers: corsHeaders });
    }

    // Auth me
    if (route === "/auth/me") {
      return NextResponse.json({ user: null }, { headers: corsHeaders });
    }

    // Dashboard
    if (route === "/dashboard") {
      const db = getPool();
      const result = await db.query(`
        SELECT 
          COUNT(*) AS total,
          SUM(CASE WHEN readiness_status='Ready' THEN 1 ELSE 0 END) AS ready,
          SUM(CASE WHEN readiness_status='Disewa' THEN 1 ELSE 0 END) AS disewa,
          SUM(CASE WHEN readiness_status='Servis' THEN 1 ELSE 0 END) AS servis,
          SUM(CASE WHEN readiness_status='Kalibrasi' THEN 1 ELSE 0 END) AS kalibrasi,
          SUM(CASE WHEN readiness_status='Rusak' THEN 1 ELSE 0 END) AS rusak,
          SUM(CASE WHEN readiness_status='Hilang' THEN 1 ELSE 0 END) AS hilang
        FROM equipment
      `);
      return NextResponse.json(result.rows[0] || {}, { headers: corsHeaders });
    }

    // Classes
    if (route === "/classes") {
      const db = getPool();
      const result = await db.query("SELECT * FROM classes ORDER BY class_code");
      return NextResponse.json(result.rows, { headers: corsHeaders });
    }

    // Warehouses
    if (route === "/warehouses") {
      const db = getPool();
      const result = await db.query("SELECT * FROM warehouses ORDER BY warehouse_code");
      return NextResponse.json(result.rows, { headers: corsHeaders });
    }

    // Equipment
    if (route === "/equipment") {
      const db = getPool();
      const result = await db.query("SELECT * FROM equipment ORDER BY equipment_id DESC LIMIT 50");
      return NextResponse.json(result.rows, { headers: corsHeaders });
    }

    // Slots
    if (route === "/slots") {
      const db = getPool();
      const result = await db.query(`
        SELECT s.*, r.rack_code, w.warehouse_code 
        FROM slots s 
        JOIN racks r ON r.rack_id = s.rack_id 
        JOIN warehouses w ON w.warehouse_id = r.warehouse_id 
        ORDER BY w.warehouse_code, r.rack_code, s.slot_code
      `);
      return NextResponse.json(result.rows, { headers: corsHeaders });
    }

    return NextResponse.json({ error: "Not found", route }, { status: 404, headers: corsHeaders });
  } catch (e) {
    console.error("API GET Error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: corsHeaders });
  }
}

// POST handler
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const route = "/" + path.join("/");

  try {
    const body = await request.json().catch(() => ({}));

    // Login
    if (route === "/auth/login") {
      const { username, password } = body;
      if (!username || !password) {
        return NextResponse.json({ error: "Missing input" }, { status: 400, headers: corsHeaders });
      }

      const db = getPool();
      const result = await db.query(sql("SELECT * FROM users WHERE username = ?"), [username]);
      const user = result.rows[0];

      if (!user) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401, headers: corsHeaders });
      }
      if (!user.is_active) {
        return NextResponse.json({ error: "Account inactive" }, { status: 403, headers: corsHeaders });
      }

      const match = user.password_hash?.startsWith("$2")
        ? await bcrypt.compare(password, user.password_hash)
        : password === user.password_hash;

      if (!match) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401, headers: corsHeaders });
      }

      await db.query(sql("UPDATE users SET last_login_at = NOW() WHERE user_id = ?"), [user.user_id]);

      return NextResponse.json({
        user: {
          user_id: user.user_id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
        },
      }, { headers: corsHeaders });
    }

    // Logout
    if (route === "/auth/logout") {
      return NextResponse.json({ ok: true }, { headers: corsHeaders });
    }

    // Create warehouse
    if (route === "/warehouses") {
      const { warehouse_code, warehouse_name } = body;
      if (!warehouse_code || !warehouse_name) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400, headers: corsHeaders });
      }
      const db = getPool();
      await db.query(
        sql("INSERT INTO warehouses (warehouse_code, warehouse_name) VALUES (?, ?)"),
        [warehouse_code, warehouse_name]
      );
      return NextResponse.json({ ok: true }, { status: 201, headers: corsHeaders });
    }

    // Create equipment
    if (route === "/equipment") {
      const { equipment_code, equipment_name, class_id } = body;
      if (!equipment_code || !equipment_name || !class_id) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400, headers: corsHeaders });
      }
      const db = getPool();
      await db.query(
        sql(`INSERT INTO equipment (equipment_code, equipment_name, class_id, readiness_status)
             VALUES (?, ?, ?, ?)`),
        [equipment_code, equipment_name, class_id, "Ready"]
      );
      return NextResponse.json({ ok: true }, { status: 201, headers: corsHeaders });
    }

    return NextResponse.json({ error: "Not found", route }, { status: 404, headers: corsHeaders });
  } catch (e) {
    console.error("API POST Error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: corsHeaders });
  }
}
