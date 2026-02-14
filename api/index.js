/**
 * Backend API untuk Vercel Functions
 * Path: /api/index.js → https://domain.vercel.app/api/*
 * 
 * Vercel otomatis menjalankan file ini sebagai serverless function
 */

const path = require("path");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const session = require("express-session");
const bcrypt = require("bcrypt");

// Load environment variables
require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
});

const app = express();
app.set("trust proxy", 1);
app.use(express.json());

// ============================================================
// CORS
// ============================================================
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
const ALLOWED_ORIGINS = [FRONTEND_ORIGIN];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
  })
);

// ============================================================
// SESSION
// ============================================================
app.use(
  session({
    name: "rdw.sid",
    secret: process.env.SESSION_SECRET || "rdw-secret-dev",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: true, // HTTPS di Vercel
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

// ============================================================
// DATABASE (PostgreSQL / Neon)
// ============================================================
const db = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  max: 5,
  ssl: { rejectUnauthorized: false },
});

// ============================================================
// HELPERS
// ============================================================
function ok(res, data) {
  return res.json(data);
}
function fail(res, message = "Server error", status = 500, extra = {}) {
  return res.status(status).json({ message, ...extra });
}

function convertSql(sql) {
  let counter = 0;
  return sql.replace(/\?/g, () => `$${++counter}`);
}

async function q(sql, params = []) {
  const convertedSql = convertSql(sql);
  const result = await db.query(convertedSql, params);
  return [result.rows, result.fields];
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function getSessionUser(req) {
  if (!req.session?.user) return null;
  return {
    user_id: req.session.user.user_id,
    full_name: req.session.user.full_name,
    username: req.session.user.username,
    role: String(req.session.user.role || "").toLowerCase(),
  };
}

function requireAuth(req, res, next) {
  const user = getSessionUser(req);
  if (!user) return fail(res, "Unauthorized", 401);
  req.user = user;
  next();
}

function requireRoles(roles = []) {
  const allow = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const user = getSessionUser(req);
    if (!user) return fail(res, "Unauthorized", 401);
    if (allow.length && !allow.includes(user.role)) {
      return fail(res, "Forbidden", 403, { role: user.role, allowed: allow });
    }
    req.user = user;
    next();
  };
}

// ============================================================
// ROUTES - Import dari backend/server.js (copy paste essential routes)
// ============================================================

app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await q("SELECT 1 AS ok");
    return ok(res, { status: "ok", db: rows?.[0]?.ok === 1 });
  } catch (e) {
    console.error("HEALTH ERROR:", e);
    return fail(res, "DB tidak terhubung", 500);
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return fail(res, "Username & password wajib diisi", 400);
    }

    const [rows] = await q(
      `SELECT user_id, full_name, username, role, password_hash, is_active
       FROM users
       WHERE username = ?
       LIMIT 1`,
      [username]
    );

    const user = rows?.[0];
    if (!user) return fail(res, "Username / password salah", 401);
    if (!user.is_active) return fail(res, "Akun nonaktif", 403);

    const stored = String(user.password_hash || "");
    let okPass = false;

    if (stored.startsWith("$2a$") || stored.startsWith("$2b$")) {
      okPass = await bcrypt.compare(password, stored);
    } else {
      okPass = password === stored;
    }

    if (!okPass) return fail(res, "Username / password salah", 401);

    req.session.user = {
      user_id: user.user_id,
      full_name: user.full_name,
      username: user.username,
      role: String(user.role || "").toLowerCase(),
    };

    await q(`UPDATE users SET last_login_at = NOW() WHERE user_id = ?`, [user.user_id]);

    return ok(res, { message: "Login berhasil", user: req.session.user });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return fail(res, "Server error");
  }
});

app.get("/api/auth/me", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return fail(res, "Unauthorized", 401);
  return ok(res, { user });
});

app.get("/api/me", requireAuth, (req, res) => {
  return ok(res, req.user);
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("LOGOUT ERROR:", err);
      return fail(res, "Logout gagal", 500);
    }
    res.clearCookie("rdw.sid");
    return ok(res, { message: "Logout berhasil" });
  });
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
  console.error("UNHANDLED ERROR:", err);
  return fail(res, err.message || "Server error", 500);
});

// ============================================================
// EXPORT UNTUK VERCEL FUNCTIONS
// ============================================================
module.exports = app;
