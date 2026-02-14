// backend/app.js
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());

// CORS: kalau API satu domain dengan FE (di Vercel), origin bisa dibuat lebih longgar,
// tapi untuk aman tetap spesifik.
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));

app.use(
  session({
    name: "rdw.sid",
    secret: process.env.SESSION_SECRET || "rdw-secret-dev",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production", // penting di production
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function q(sql, params = []) {
  return db.query(sql, params);
}

// --- paste semua routes kamu di sini (tanpa app.listen) ---
// export app:
module.exports = { app };
