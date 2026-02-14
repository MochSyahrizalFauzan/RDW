/**
 * Vercel Serverless API
 * Handles all backend requests at /api/*
 */

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

// Get env vars from Vercel
const DB_HOST = process.env.DB_HOST;
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_USER = process.env.DB_USER;
const DB_PASS = process.env.DB_PASS;
const DB_NAME = process.env.DB_NAME;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret";

console.log("✅ API initialization - DB:", DB_HOST ? "configured" : "MISSING");

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "10mb" }));

// CORS
app.use(cors({ origin: "*", credentials: true }));

// Global users session (in-memory, use Redis in production)
const sessions = new Map();

// Database
let db;
try {
  db = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    max: 5,
    ssl: { rejectUnauthorized: false },
  });
} catch (e) {
  console.error("DB error:", e.message);
}

// Helpers
const respond = (res, data, status = 200) => res.status(status).json(data);
const error = (res, msg, status = 400) => res.status(status).json({ error: msg });

// SQL helper - convert MySQL ? to PostgreSQL $
function convertSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function query(sql, params = []) {
  try {
    if (!db) throw new Error("DB not initialized");
    const result = await db.query(convertSql(sql), params);
    return result.rows;
  } catch (e) {
    console.error("Query error:", e.message);
    throw e;
  }
}

// ============================================================
// ROUTES
// ============================================================

// Health check
app.get("/api/health", async (req, res) => {
  try {
    if (db) await db.query("SELECT 1");
    respond(res, { ok: true });
  } catch (e) {
    error(res, "Database error", 500);
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return error(res, "Invalid input");

    const rows = await query(
      `SELECT user_id, full_name, username, role, password_hash, is_active 
       FROM users WHERE username = ? LIMIT 1`,
      [username]
    );

    const user = rows[0];
    if (!user) return error(res, "Invalid credentials", 401);
    if (!user.is_active) return error(res, "Account disabled", 403);

    const match = user.password_hash.startsWith("$2")
      ? await bcrypt.compare(password, user.password_hash)
      : password === user.password_hash;

    if (!match) return error(res, "Invalid credentials", 401);

    const sessionId = Math.random().toString(36).substring(7);
    sessions.set(sessionId, {
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    });

    res.cookie("sid", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
    });

    await query(`UPDATE users SET last_login_at = NOW() WHERE user_id = ?`, [
      user.user_id,
    ]);

    respond(res, {
      message: "Login success",
      user: sessions.get(sessionId),
    });
  } catch (e) {
    console.error("Login error:", e.message);
    error(res, "Server error", 500);
  }
});

// Get current user
app.get("/api/auth/me", (req, res) => {
  const sid = req.cookies?.sid;
  const user = sid ? sessions.get(sid) : null;
  if (!user) return error(res, "Not authenticated", 401);
  respond(res, { user });
});

// Me endpoint
app.get("/api/me", (req, res) => {
  const sid = req.cookies?.sid;
  const user = sid ? sessions.get(sid) : null;
  if (!user) return error(res, "Unauthorized", 401);
  respond(res, user);
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  const sid = req.cookies?.sid;
  if (sid) sessions.delete(sid);
  res.clearCookie("sid");
  respond(res, { message: "Logged out" });
});

// Dashboard
app.get("/api/dashboard", async (req, res) => {
  try {
    const rows = await query(`
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
    respond(res, { kpi: rows[0] || {} });
  } catch (e) {
    error(res, "Error", 500);
  }
});

// Classes
app.get("/api/classes", async (req, res) => {
  try {
    const rows = await query(`SELECT * FROM classes ORDER BY class_code`);
    respond(res, rows);
  } catch (e) {
    error(res, "Error", 500);
  }
});

// Warehouses
app.get("/api/warehouses", async (req, res) => {
  try {
    const rows = await query(`SELECT * FROM warehouses ORDER BY warehouse_code`);
    respond(res, rows);
  } catch (e) {
    error(res, "Error", 500);
  }
});

app.post("/api/warehouses", async (req, res) => {
  try {
    const { warehouse_code, warehouse_name } = req.body;
    if (!warehouse_code || !warehouse_name) return error(res, "Invalid input");

    await query(
      `INSERT INTO warehouses (warehouse_code, warehouse_name) VALUES (?, ?)`,
      [warehouse_code, warehouse_name]
    );
    respond(res, { message: "Created" }, 201);
  } catch (e) {
    error(res, e.message, 500);
  }
});

// Equipment
app.get("/api/equipment", async (req, res) => {
  try {
    const rows = await query(`SELECT * FROM equipment ORDER BY equipment_id DESC LIMIT 100`);
    respond(res, rows);
  } catch (e) {
    error(res, "Error", 500);
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  error(res, "Server error", 500);
});

module.exports = app;
