/**
 * Vercel API Routes
 * Simple, working backend for RDW app
 */

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cors({ origin: "*", credentials: true }));

// Database connection
const db = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  max: 3,
  ssl: { rejectUnauthorized: false },
});

console.log("🚀 API initialized");

// Helper: Convert MySQL ? to PostgreSQL $n
function sql(query) {
  let i = 0;
  return query.replace(/\?/g, () => `$${++i}`);
}

// Health check
app.get("/api/health", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.json({ ok: true, time: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing input" });

    const result = await db.query(sql("SELECT * FROM users WHERE username = ?"), [username]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (!user.is_active) return res.status(403).json({ error: "Account inactive" });

    const match = user.password_hash?.startsWith("$2")
      ? await bcrypt.compare(password, user.password_hash)
      : password === user.password_hash;

    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    await db.query(sql("UPDATE users SET last_login_at = NOW() WHERE user_id = ?"), [user.user_id]);

    res.json({
      user: {
        user_id: user.user_id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// Get user
app.get("/api/auth/me", (req, res) => {
  res.json({ user: null });
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  res.json({ ok: true });
});

// Dashboard
app.get("/api/dashboard", async (req, res) => {
  try {
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
    res.json(result.rows[0] || {});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Classes
app.get("/api/classes", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM classes ORDER BY class_code");
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Warehouses
app.get("/api/warehouses", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM warehouses ORDER BY warehouse_code");
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/warehouses", async (req, res) => {
  try {
    const { warehouse_code, warehouse_name } = req.body;
    if (!warehouse_code || !warehouse_name) return res.status(400).json({ error: "Invalid input" });

    await db.query(
      sql("INSERT INTO warehouses (warehouse_code, warehouse_name) VALUES (?, ?)"),
      [warehouse_code, warehouse_name]
    );

    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Equipment
app.get("/api/equipment", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM equipment ORDER BY equipment_id DESC LIMIT 50"
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/equipment", async (req, res) => {
  try {
    const { equipment_code, equipment_name, class_id } = req.body;
    if (!equipment_code || !equipment_name || !class_id) {
      return res.status(400).json({ error: "Invalid input" });
    }

    await db.query(
      sql(`INSERT INTO equipment (equipment_code, equipment_name, class_id, readiness_status)
           VALUES (?, ?, ?, ?)`),
      [equipment_code, equipment_name, class_id, "Ready"]
    );

    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Slots
app.get("/api/slots", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*, r.rack_code, w.warehouse_code 
      FROM slots s 
      JOIN racks r ON r.rack_id = s.rack_id 
      JOIN warehouses w ON w.warehouse_id = r.warehouse_id 
      ORDER BY w.warehouse_code, r.rack_code, s.slot_code
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ error: "Server error" });
});

module.exports = app;
