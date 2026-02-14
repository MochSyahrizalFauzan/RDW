/* backend/server.js */
const path = require("path");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const session = require("express-session");
const bcrypt = require("bcrypt");


require("dotenv").config({
  path: path.join(__dirname, "..", ".env.local"),
});

// ============================================================
// APP
// ============================================================
const app = express();
app.set("trust proxy", 1);

// JSON
app.use(express.json());

// ============================================================
// CORS (SINGLE SOURCE OF TRUTH)
// ============================================================
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
const ALLOWED_ORIGINS = [FRONTEND_ORIGIN];

app.use(
  cors({
    origin(origin, cb) {
      // allow same-origin / postman / curl (origin undefined)
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
  })
);

// ============================================================
// SESSION (Login sederhana tanpa JWT)
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
      secure: false, // https -> true
      maxAge: 1000 * 60 * 60 * 8, // 8 jam
    },
  })
);

// ============================================================
// DB POOL (PostgreSQL)
// ============================================================
const db = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "sistema_penempatan_rdw",
  port: Number(process.env.DB_PORT || 5432),
  max: 10,
  ssl: { rejectUnauthorized: false }, // Neon requires SSL
});

// ============================================================
// Helpers
// ============================================================
function ok(res, data) {
  return res.json(data);
}
function fail(res, message = "Server error", status = 500, extra = {}) {
  return res.status(status).json({ message, ...extra });
}

// Helper untuk convert ? ke $1, $2, etc (PostgreSQL style)
function convertSql(sql) {
  let counter = 0;
  return sql.replace(/\?/g, () => `$${++counter}`);
}

async function q(sql, params = []) {
  const convertedSql = convertSql(sql);
  const result = await db.query(convertedSql, params);
  // Return format kompatibel dengan mysql2: [rows, fields]
  return [result.rows, result.fields];
}

// ============================================================
// AUTH MIDDLEWARE (SESSION FIRST)
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
// AUTH ENDPOINTS
// ============================================================
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

    // Support bcrypt hash & plain text (DEV)
    const stored = String(user.password_hash || "");
    let okPass = false;

    if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
      okPass = await bcrypt.compare(password, stored);
    } else {
      okPass = password === stored; // plain text
    }

    if (!okPass) return fail(res, "Username / password salah", 401);

    // simpan session minimal
    req.session.user = {
      user_id: user.user_id,
      full_name: user.full_name,
      username: user.username,
      role: String(user.role || "").toLowerCase(),
    };

    await q(`UPDATE users SET last_login_at = NOW() WHERE user_id = ?`, [
      user.user_id,
    ]);

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
// Health Check
// ============================================================
app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await q("SELECT 1 AS ok");
    return ok(res, { status: "ok", db: rows?.[0]?.ok === 1, envLoaded: true });
  } catch (e) {
    console.error("HEALTH ERROR:", e);
    return fail(res, "DB tidak terhubung", 500);
  }
});

// ============================================================
// ME (alias supaya FE bisa pakai /api/me)
// ============================================================
app.get("/api/me", requireAuth, (req, res) => {
  return ok(res, req.user); // bentuknya langsung user (bukan {user})
});

// opsional: update profil (buat Settings page)
app.patch("/api/me", requireAuth, async (req, res) => {
  try {
    const full_name = req.body?.full_name ? String(req.body.full_name).trim() : null;

    if (!full_name) return fail(res, "full_name wajib", 400);

    await q(`UPDATE users SET full_name = ? WHERE user_id = ?`, [
      full_name,
      req.user.user_id,
    ]);

    // update session juga biar Topbar/Sidebar update
    req.session.user.full_name = full_name;

    return ok(res, { message: "Profil berhasil diperbarui" });
  } catch (e) {
    console.error("PATCH /api/me ERROR:", e);
    return fail(res, "Gagal update profil");
  }
});

// ============================================================
// USERS (admin only) - minimal untuk Settings page
// ============================================================
app.get("/api/users", requireRoles(["admin"]), async (req, res) => {
  try {
    const [rows] = await q(`
      SELECT user_id, full_name, username, role, is_active, created_at
      FROM users
      ORDER BY user_id DESC
    `);
    return ok(res, rows);
  } catch (e) {
    console.error("GET /api/users ERROR:", e);
    return fail(res, "Gagal memuat users");
  }
});

app.post("/api/users", requireRoles(["admin"]), async (req, res) => {
  try {
    const full_name = String(req.body?.full_name || "").trim();
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "frontdesk").toLowerCase();
    const is_active = Number(req.body?.is_active) ? 1 : 0;

    if (!full_name || !username || !password) {
      return fail(res, "full_name, username, password wajib", 400);
    }

    const password_hash = await bcrypt.hash(password, 10);

    await q(
      `INSERT INTO users (full_name, username, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [full_name, username, password_hash, role, is_active]
    );

    return res.status(201).json({ message: "User berhasil ditambahkan" });
  } catch (e) {
    console.error("POST /api/users ERROR:", e);
    if (String(e?.code) === "ER_DUP_ENTRY") {
      return fail(res, "Username sudah digunakan", 409);
    }
    return fail(res, "Gagal tambah user");
  }
});

app.patch("/api/users/:id", requireRoles(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, "id tidak valid", 400);

    const fields = [];
    const params = [];

    if ("role" in req.body) {
      fields.push("role = ?");
      params.push(String(req.body.role || "").toLowerCase());
    }
    if ("is_active" in req.body) {
      fields.push("is_active = ?");
      params.push(Number(req.body.is_active) ? 1 : 0);
    }

    if (!fields.length) return fail(res, "Tidak ada field diupdate", 400);

    params.push(id);

    await q(`UPDATE users SET ${fields.join(", ")} WHERE user_id = ?`, params);
    return ok(res, { message: "User berhasil diupdate" });
  } catch (e) {
    console.error("PATCH /api/users/:id ERROR:", e);
    return fail(res, "Gagal update user");
  }
});


// ============================================================
// DASHBOARD
// ============================================================
app.get(
  "/api/dashboard",
  requireRoles(["admin", "frontdesk", "teknisi", "manager"]),
  async (req, res) => {
    try {
      // 1) KPI status barang (biarkan tetap ada agar kompatibel jika ada page lain yg masih pakai)
      const [kpiRows] = await q(`
        SELECT 
          COUNT(*) AS total,
          SUM(readiness_status='Ready') AS ready,
          SUM(readiness_status='Disewa') AS disewa,
          SUM(readiness_status='Servis') AS servis,
          SUM(readiness_status='Kalibrasi') AS kalibrasi,
          SUM(readiness_status='Rusak') AS rusak,
          SUM(readiness_status='Hilang') AS hilang
        FROM equipment
      `);

      const kpi =
        kpiRows?.[0] ?? {
          total: 0,
          ready: 0,
          disewa: 0,
          servis: 0,
          kalibrasi: 0,
          rusak: 0,
          hilang: 0,
        };

      // 2) Utilisasi per gudang (slot terpakai berdasarkan equipment.current_slot_id)
      const [utilRows] = await q(`
        SELECT 
          w.warehouse_id,
          w.warehouse_code,
          w.warehouse_name,
          COUNT(s.slot_id) AS total_slots,
          SUM(CASE WHEN e.equipment_id IS NULL THEN 0 ELSE 1 END) AS occupied_slots,
          ROUND(
            (SUM(CASE WHEN e.equipment_id IS NULL THEN 0 ELSE 1 END) / NULLIF(COUNT(s.slot_id),0)) * 100
          , 0) AS utilization_pct
        FROM warehouses w
        LEFT JOIN racks r ON r.warehouse_id = w.warehouse_id
        LEFT JOIN slots s ON s.rack_id = r.rack_id
        LEFT JOIN equipment e ON e.current_slot_id = s.slot_id
        GROUP BY w.warehouse_id
        ORDER BY w.warehouse_code ASC
      `);

      // 3) Alert rak hampir penuh
      const [rackAlert] = await q(`
        SELECT 
          w.warehouse_code, w.warehouse_name,
          r.rack_id, r.rack_code, r.zone,
          COUNT(s.slot_id) AS total_slots,
          SUM(CASE WHEN e.equipment_id IS NULL THEN 0 ELSE 1 END) AS occupied_slots,
          ROUND(
            (SUM(CASE WHEN e.equipment_id IS NULL THEN 0 ELSE 1 END) / NULLIF(COUNT(s.slot_id),0)) * 100
          , 0) AS utilization_pct
        FROM racks r
        JOIN warehouses w ON w.warehouse_id = r.warehouse_id
        LEFT JOIN slots s ON s.rack_id = r.rack_id
        LEFT JOIN equipment e ON e.current_slot_id = s.slot_id
        GROUP BY r.rack_id
        HAVING utilization_pct >= 80 AND total_slots > 0
        ORDER BY utilization_pct DESC
        LIMIT 10
      `);

      // 4) Breakdown status non-ready (opsional, boleh tetap dipakai untuk alert)
      const [unavailableRows] = await q(`
        SELECT readiness_status, COUNT(*) AS total
        FROM equipment
        WHERE readiness_status <> 'Ready'
        GROUP BY readiness_status
        ORDER BY total DESC
      `);

      // 5) List kalibrasi (opsional)
      const [kalRows] = await q(`
        SELECT equipment_id, equipment_code, equipment_name, readiness_status, updated_at, created_at
        FROM equipment
        WHERE readiness_status='Kalibrasi'
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT 10
      `);

      // ============================================================
      //  STORAGE KPI (FOCUS DASHBOARD)
      // - dihitung dari utilRows agar ringan
      // ============================================================
      const totalSlotsAll = (utilRows || []).reduce(
        (a, x) => a + Number(x.total_slots || 0),
        0
      );
      const occupiedSlotsAll = (utilRows || []).reduce(
        (a, x) => a + Number(x.occupied_slots || 0),
        0
      );
      const emptySlotsAll = Math.max(0, totalSlotsAll - occupiedSlotsAll);
      const utilizationAllPct = totalSlotsAll
        ? Math.round((occupiedSlotsAll / totalSlotsAll) * 100)
        : 0;

      const storage_kpi = {
        total_slots: totalSlotsAll,
        occupied_slots: occupiedSlotsAll,
        empty_slots: emptySlotsAll,
        utilization_pct: utilizationAllPct,
        racks_near_full: Array.isArray(rackAlert) ? rackAlert.length : 0,
      };

      return ok(res, {
        // tetap ada supaya kompatibel
        kpi,

        // baru: dipakai dashboard FE terbaru
        storage_kpi,

        utilization_by_warehouse: utilRows,
        alerts: {
          racks_near_full: rackAlert,
          unavailable_breakdown: unavailableRows,
          calibration_list: kalRows,
        },
      });
    } catch (e) {
      console.error("DASHBOARD ERROR:", e);
      return fail(res, "Gagal memuat dashboard");
    }
  }
);


// ============================================================
// CLASSES
// ============================================================
app.get(
  "/api/classes",
  requireRoles(["admin", "frontdesk", "teknisi", "manager"]),
  async (req, res) => {
    try {
      const [rows] = await q(`
        SELECT class_id, class_code, class_name, description, created_at
        FROM classes
        ORDER BY class_code ASC
      `);
      return ok(res, rows);
    } catch (e) {
      console.error("CLASSES ERROR:", e);
      return fail(res, "Gagal memuat classes");
    }
  }
);

// ============================================================
// WAREHOUSES
// ============================================================
app.get(
  "/api/warehouses",
  requireRoles(["admin", "frontdesk", "teknisi", "manager"]),
  async (req, res) => {
    try {
      const [rows] = await q(`
        SELECT warehouse_id, warehouse_code, warehouse_name, address, capacity, created_at
        FROM warehouses
        ORDER BY warehouse_code ASC
      `);
      return ok(res, rows);
    } catch (e) {
      console.error("WAREHOUSES ERROR:", e);
      return fail(res, "Gagal memuat warehouses");
    }
  }
);

app.post("/api/warehouses", requireRoles(["admin"]), async (req, res) => {
  try {
    const { warehouse_code, warehouse_name, address, capacity } = req.body;
    if (!warehouse_code || !warehouse_name) {
      return fail(res, "warehouse_code & warehouse_name wajib", 400);
    }

    await q(
      `INSERT INTO warehouses (warehouse_code, warehouse_name, address, capacity)
       VALUES (?, ?, ?, ?)`,
      [
        warehouse_code,
        warehouse_name,
        address || null,
        capacity ? Number(capacity) : null,
      ]
    );

    return res.status(201).json({ message: "Berhasil tambah gudang" });
  } catch (e) {
    console.error("ADD WAREHOUSE ERROR:", e);
    if (String(e?.code) === "ER_DUP_ENTRY")
      return fail(res, "Kode gudang sudah digunakan", 409);
    return fail(res, "Gagal tambah gudang");
  }
});

// ============================================================
// RACKS
// ============================================================
app.get(
  "/api/racks",
  requireRoles(["admin", "frontdesk", "teknisi", "manager"]),
  async (req, res) => {
    try {
      const warehouseId = req.query.warehouse_id
        ? Number(req.query.warehouse_id)
        : null;

      const [rows] = await q(
        `
        SELECT 
          r.rack_id, r.warehouse_id, r.rack_code, r.zone, r.capacity, r.created_at,
          w.warehouse_code, w.warehouse_name
        FROM racks r
        JOIN warehouses w ON w.warehouse_id = r.warehouse_id
        ${warehouseId ? "WHERE r.warehouse_id = ?" : ""}
        ORDER BY w.warehouse_code ASC, r.rack_code ASC
        `,
        warehouseId ? [warehouseId] : []
      );

      return ok(res, rows);
    } catch (e) {
      console.error("RACKS ERROR:", e);
      return fail(res, "Gagal memuat racks");
    }
  }
);

app.post("/api/racks", requireRoles(["admin"]), async (req, res) => {
  try {
    const { warehouse_id, rack_code, zone, capacity } = req.body;
    if (!warehouse_id || !rack_code)
      return fail(res, "warehouse_id & rack_code wajib", 400);

    await q(
      `INSERT INTO racks (warehouse_id, rack_code, zone, capacity)
       VALUES (?, ?, ?, ?)`,
      [
        Number(warehouse_id),
        rack_code,
        zone || null,
        capacity ? Number(capacity) : null,
      ]
    );

    return res.status(201).json({ message: "Berhasil tambah rak" });
  } catch (e) {
    console.error("ADD RACK ERROR:", e);
    if (String(e?.code) === "ER_DUP_ENTRY")
      return fail(res, "Kode rak sudah ada di gudang ini", 409);
    return fail(res, "Gagal tambah rak");
  }
});

// ============================================================
// SLOTS (+ occupancy)
// ============================================================
app.get(
  "/api/slots",
  requireRoles(["admin", "frontdesk", "teknisi", "manager"]),
  async (req, res) => {
    try {
      const rackId = req.query.rack_id ? Number(req.query.rack_id) : null;
      const warehouseId = req.query.warehouse_id
        ? Number(req.query.warehouse_id)
        : null;

      const where = [];
      const params = [];

      if (rackId) {
        where.push("s.rack_id = ?");
        params.push(rackId);
      }
      if (warehouseId) {
        where.push("w.warehouse_id = ?");
        params.push(warehouseId);
      }

      const [rows] = await q(
        `
        SELECT 
          s.slot_id, s.rack_id, s.slot_code, s.slot_label, s.notes, s.created_at,
          r.rack_code, r.zone, r.warehouse_id,
          w.warehouse_code, w.warehouse_name,
          e.equipment_id, e.equipment_code, e.equipment_name, e.readiness_status
        FROM slots s
        JOIN racks r ON r.rack_id = s.rack_id
        JOIN warehouses w ON w.warehouse_id = r.warehouse_id
        LEFT JOIN equipment e ON e.current_slot_id = s.slot_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY w.warehouse_code ASC, r.rack_code ASC, s.slot_code ASC
        `,
        params
      );

      return ok(res, rows);
    } catch (e) {
      console.error("SLOTS ERROR:", e);
      return fail(res, "Gagal memuat slots");
    }
  }
);

app.post("/api/slots", requireRoles(["admin"]), async (req, res) => {
  try {
    const { rack_id, slot_code, slot_label, notes } = req.body;
    if (!rack_id || !slot_code)
      return fail(res, "rack_id & slot_code wajib", 400);

    await q(
      `INSERT INTO slots (rack_id, slot_code, slot_label, notes)
       VALUES (?, ?, ?, ?)`,
      [Number(rack_id), slot_code, slot_label || null, notes || null]
    );

    return res.status(201).json({ message: "Berhasil tambah slot" });
  } catch (e) {
    console.error("ADD SLOT ERROR:", e);
    if (String(e?.code) === "ER_DUP_ENTRY")
      return fail(res, "Kode slot sudah ada di rak ini", 409);
    return fail(res, "Gagal tambah slot");
  }
});

// ============================================================
// EQUIPMENT - pagination + filter
// GET /api/equipment?q=&status=&class_id=&warehouse_id=&page=&page_size=
// ============================================================
app.get(
  "/api/equipment",
  requireRoles(["admin", "frontdesk", "teknisi", "manager"]),
  async (req, res) => {
    try {
      const qText = String(req.query.q || "").trim();
      const status = String(req.query.status || "").trim();
      const classId = req.query.class_id ? Number(req.query.class_id) : null;
      const warehouseId = req.query.warehouse_id
        ? Number(req.query.warehouse_id)
        : null;

      const page = Math.max(1, Number(req.query.page || 1));
      const pageSize = Math.min(
        Math.max(5, Number(req.query.page_size || 12)),
        100
      );
      const offset = (page - 1) * pageSize;

      const where = [];
      const params = [];

      if (qText) {
        where.push(`(
          e.equipment_code LIKE ? OR e.equipment_name LIKE ? OR 
          IFNULL(e.serial_number,'') LIKE ? OR IFNULL(e.brand,'') LIKE ? OR IFNULL(e.model,'') LIKE ?
        )`);
        const like = `%${qText}%`;
        params.push(like, like, like, like, like);
      }
      if (status) {
        where.push(`e.readiness_status = ?`);
        params.push(status);
      }
      if (classId) {
        where.push(`e.class_id = ?`);
        params.push(classId);
      }
      if (warehouseId) {
        where.push(`w.warehouse_id = ?`);
        params.push(warehouseId);
      }

      const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const [countRows] = await q(
        `
        SELECT COUNT(*) AS total
        FROM equipment e
        JOIN classes c ON c.class_id = e.class_id
        LEFT JOIN slots s ON s.slot_id = e.current_slot_id
        LEFT JOIN racks r ON r.rack_id = s.rack_id
        LEFT JOIN warehouses w ON w.warehouse_id = r.warehouse_id
        ${whereSQL}
        `,
        params
      );

      const total = Number(countRows?.[0]?.total || 0);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      const [rows] = await q(
        `
        SELECT 
          e.equipment_id, e.equipment_code, e.equipment_name,
          e.serial_number, e.brand, e.model,
          e.readiness_status, e.current_slot_id,
          c.class_id, c.class_code, c.class_name,
          w.warehouse_id, w.warehouse_code, w.warehouse_name,
          r.rack_id, r.rack_code, r.zone,
          s.slot_id, s.slot_code, s.slot_label,
          e.created_at, e.updated_at
        FROM equipment e
        JOIN classes c ON c.class_id = e.class_id
        LEFT JOIN slots s ON s.slot_id = e.current_slot_id
        LEFT JOIN racks r ON r.rack_id = s.rack_id
        LEFT JOIN warehouses w ON w.warehouse_id = r.warehouse_id
        ${whereSQL}
        ORDER BY e.equipment_id DESC
        LIMIT ? OFFSET ?
        `,
        [...params, pageSize, offset]
      );

      return ok(res, {
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages,
        rows,
      });
    } catch (e) {
      console.error("EQUIPMENT LIST ERROR:", e);
      return fail(res, "Gagal memuat equipment");
    }
  }
);

app.post("/api/equipment", requireRoles(["admin"]), async (req, res) => {
  try {
    const {
      equipment_code,
      equipment_name,
      class_id,
      serial_number,
      brand,
      model,
      condition_note,
      readiness_status,
      current_slot_id,
    } = req.body;

    if (!equipment_code || !equipment_name || !class_id) {
      return fail(res, "equipment_code, equipment_name, class_id wajib", 400);
    }

    await q(
      `
      INSERT INTO equipment
        (equipment_code, equipment_name, class_id, serial_number, brand, model, condition_note, readiness_status, current_slot_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        equipment_code,
        equipment_name,
        Number(class_id),
        serial_number || null,
        brand || null,
        model || null,
        condition_note || null,
        readiness_status || "Ready",
        current_slot_id ? Number(current_slot_id) : null,
      ]
    );

    return res.status(201).json({ message: "Berhasil tambah barang" });
  } catch (e) {
    console.error("ADD EQUIPMENT ERROR:", e);
    if (String(e?.code) === "ER_DUP_ENTRY")
      return fail(res, "Kode barang sudah digunakan", 409);
    return fail(res, "Gagal tambah barang");
  }
});

// ============================================================
// EQUIPMENT STATS (GLOBAL KPI BY FILTER)
// GET /api/equipment/stats?q=&status=&class_id=&warehouse_id=
// ============================================================
app.get(
  "/api/equipment/stats",
  requireRoles(["admin", "frontdesk", "teknisi", "manager"]),
  async (req, res) => {
    try {
      const qText = String(req.query.q || "").trim();
      const status = String(req.query.status || "").trim();
      const classId = req.query.class_id ? Number(req.query.class_id) : null;
      const warehouseId = req.query.warehouse_id
        ? Number(req.query.warehouse_id)
        : null;

      const where = [];
      const params = [];

      if (qText) {
        where.push(`(
          e.equipment_code LIKE ? OR e.equipment_name LIKE ? OR 
          IFNULL(e.serial_number,'') LIKE ? OR IFNULL(e.brand,'') LIKE ? OR IFNULL(e.model,'') LIKE ?
        )`);
        const like = `%${qText}%`;
        params.push(like, like, like, like, like);
      }

      if (status) {
        where.push(`e.readiness_status = ?`);
        params.push(status);
      }

      if (classId) {
        where.push(`e.class_id = ?`);
        params.push(classId);
      }

      if (warehouseId) {
        // perlu join slot->rack->warehouse
        where.push(`w.warehouse_id = ?`);
        params.push(warehouseId);
      }

      const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const [rows] = await q(
        `
        SELECT
          COUNT(*) AS total,
          SUM(e.readiness_status='Ready') AS ready,
          SUM(e.readiness_status='Disewa') AS disewa,
          SUM(e.readiness_status='Servis') AS servis,
          SUM(e.readiness_status='Kalibrasi') AS kalibrasi,
          SUM(e.readiness_status='Rusak') AS rusak,
          SUM(e.readiness_status='Hilang') AS hilang
        FROM equipment e
        JOIN classes c ON c.class_id = e.class_id
        LEFT JOIN slots s ON s.slot_id = e.current_slot_id
        LEFT JOIN racks r ON r.rack_id = s.rack_id
        LEFT JOIN warehouses w ON w.warehouse_id = r.warehouse_id
        ${whereSQL}
        `,
        params
      );

      const kpi = rows?.[0] ?? {
        total: 0,
        ready: 0,
        disewa: 0,
        servis: 0,
        kalibrasi: 0,
        rusak: 0,
        hilang: 0,
      };

      return ok(res, kpi);
    } catch (e) {
      console.error("EQUIPMENT STATS ERROR:", e);
      return fail(res, "Gagal memuat statistik equipment");
    }
  }
);


app.patch("/api/equipment/:id", requireRoles(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);

    const allowed = [
      "equipment_code",
      "equipment_name",
      "class_id",
      "serial_number",
      "brand",
      "model",
      "condition_note",
      "readiness_status",
      "current_slot_id",
    ];

    const fields = [];
    const params = [];

    for (const key of allowed) {
      if (key in req.body) {
        fields.push(`${key} = ?`);
        const v = req.body[key];
        if (key === "class_id") params.push(v ? Number(v) : null);
        else if (key === "current_slot_id") params.push(v ? Number(v) : null);
        else params.push(v ?? null);
      }
    }

    if (!fields.length) return fail(res, "Tidak ada field yang diupdate", 400);
    params.push(id);

    await q(
      `UPDATE equipment SET ${fields.join(", ")} WHERE equipment_id = ?`,
      params
    );
    return ok(res, { message: "Berhasil update barang" });
  } catch (e) {
    console.error("UPDATE EQUIPMENT ERROR:", e);
    return fail(res, "Gagal update barang");
  }
});

app.delete("/api/equipment/:id", requireRoles(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await q(`DELETE FROM equipment WHERE equipment_id = ?`, [id]);
    return ok(res, { message: "Berhasil hapus barang" });
  } catch (e) {
    console.error("DELETE EQUIPMENT ERROR:", e);
    return fail(res, "Gagal hapus barang");
  }
});

// ============================================================
// PLACEMENTS (move equipment + log history)
// ============================================================
app.post("/api/placements", requireRoles(["admin"]), async (req, res) => {
  const client = await db.connect();
  const performed_by = req.user?.user_id ?? null;
  try {
    const equipment_id = Number(req.body.equipment_id);
    const to_slot_id = req.body.to_slot_id ? Number(req.body.to_slot_id) : null;
    const status_after = req.body.status_after ?? null;
    const description = req.body.description ?? null;

    if (!equipment_id) return fail(res, "equipment_id wajib", 400);

    await client.query("BEGIN");

    const prevResult = await client.query(
      convertSql(`SELECT equipment_id, current_slot_id, readiness_status FROM equipment WHERE equipment_id = ?`),
      [equipment_id]
    );
    const prev = prevResult.rows?.[0];
    
    if (!prev) {
      await client.query("ROLLBACK");
      return fail(res, "Barang tidak ditemukan", 404);
    }

    if (to_slot_id) {
      const slotResult = await client.query(
        convertSql(`SELECT slot_id FROM slots WHERE slot_id = ?`),
        [to_slot_id]
      );
      if (!slotResult.rows?.length) {
        await client.query("ROLLBACK");
        return fail(res, "Slot tujuan tidak valid", 400);
      }
    }

    const from_slot_id = prev.current_slot_id ?? null;
    const status_before = prev.readiness_status ?? null;

    const setParts = ["current_slot_id = $1"];
    const setVals = [to_slot_id];

    if (status_after) {
      setParts.push(`readiness_status = $${setVals.length + 1}`);
      setVals.push(status_after);
    }

    setVals.push(equipment_id);

    const updateSql = `UPDATE equipment SET ${setParts.join(", ")} WHERE equipment_id = $${setVals.length}`;
    await client.query(updateSql, setVals);

    await client.query(
      convertSql(`
        INSERT INTO placement_history
          (equipment_id, from_slot_id, to_slot_id, status_before, status_after, description, performed_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
      [equipment_id, from_slot_id, to_slot_id, status_before, status_after, description, performed_by]
    );

    await client.query("COMMIT");
    return res.status(201).json({ message: "Penempatan berhasil disimpan" });
  } catch (e) {
    console.error("PLACEMENTS ERROR:", e);
    await client.query("ROLLBACK");
    return fail(res, "Gagal simpan penempatan");
  } finally {
    client.release();
  }
});


// ============================================================
// EQUIPMENT BELUM DITEMPATKAN
// ============================================================
app.get(
  "/api/equipment/unplaced",
  requireRoles(["admin", "frontdesk", "teknisi", "manager"]),
  async (req, res) => {
    try {
      const [rows] = await q(`
        SELECT 
          e.equipment_id,
          e.equipment_code,
          e.equipment_name,
          c.class_code,
          c.class_name,
          e.readiness_status
        FROM equipment e
        JOIN classes c ON c.class_id = e.class_id
        WHERE e.current_slot_id IS NULL
        ORDER BY c.class_code, e.equipment_code
      `);

      return ok(res, rows);
    } catch (e) {
      console.error("UNPLACED ERROR:", e);
      return fail(res, "Gagal memuat barang belum ditempatkan");
    }
  }
);


// ============================================================
// SLOT KOSONG
// ============================================================
app.get(
  "/api/slots/empty",
  requireRoles(["admin", "frontdesk", "teknisi", "manager"]),
  async (req, res) => {
    try {
      const [rows] = await q(`
        SELECT 
          s.slot_id,
          s.slot_code,
          r.rack_code,
          r.zone,
          w.warehouse_code
        FROM slots s
        JOIN racks r ON r.rack_id = s.rack_id
        JOIN warehouses w ON w.warehouse_id = r.warehouse_id
        LEFT JOIN equipment e ON e.current_slot_id = s.slot_id
        WHERE e.equipment_id IS NULL
        ORDER BY w.warehouse_code, r.rack_code, s.slot_code
      `);

      return ok(res, rows);
    } catch (e) {
      console.error("EMPTY SLOT ERROR:", e);
      return fail(res, "Gagal memuat slot kosong");
    }
  }
);



// ============================================================
// HISTORY (filter + pagination)
// GET /api/history?q=&equipment_id=&warehouse_id=&class_id=&performed_by=&date_from=&date_to=&page=&page_size=
// ============================================================
app.get(
  "/api/history",
  requireRoles(["admin", "frontdesk", "teknisi", "manager"]),
  async (req, res) => {
    try {
      const qText = String(req.query.q || "").trim();
      const equipmentId = req.query.equipment_id ? Number(req.query.equipment_id) : null;
      const warehouseId = req.query.warehouse_id ? Number(req.query.warehouse_id) : null;
      const classId = req.query.class_id ? Number(req.query.class_id) : null;
      const performedBy = req.query.performed_by ? Number(req.query.performed_by) : null;

      const dateFrom = String(req.query.date_from || "").trim(); // YYYY-MM-DD
      const dateTo = String(req.query.date_to || "").trim();     // YYYY-MM-DD

      const page = Math.max(1, Number(req.query.page || 1));
      const pageSize = Math.min(Math.max(10, Number(req.query.page_size || 20)), 100);
      const offset = (page - 1) * pageSize;

      const where = [];
      const params = [];

      if (qText) {
        const like = `%${qText}%`;
        where.push(`(
          e.equipment_code LIKE ? OR e.equipment_name LIKE ? OR
          COALESCE(e.serial_number,'') LIKE ? OR
          COALESCE(h.description,'') LIKE ? OR
          COALESCE(u.full_name,'') LIKE ?
        )`);
        params.push(like, like, like, like, like);
      }

      if (equipmentId) {
        where.push("h.equipment_id = ?");
        params.push(equipmentId);
      }

      if (warehouseId) {
        // warehouse filter via from/to slot -> rack -> warehouse
        where.push(`(
          fw.warehouse_id = ? OR tw.warehouse_id = ?
        )`);
        params.push(warehouseId, warehouseId);
      }

      if (classId) {
        where.push("e.class_id = ?");
        params.push(classId);
      }

      if (performedBy) {
        where.push("h.performed_by = ?");
        params.push(performedBy);
      }

      if (dateFrom) {
        where.push("DATE(h.created_at) >= DATE(?)");
        params.push(dateFrom);
      }

      if (dateTo) {
        where.push("DATE(h.created_at) <= DATE(?)");
        params.push(dateTo);
      }

      const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const [countRows] = await q(
        `
        SELECT COUNT(*) AS total
        FROM placement_history h
        JOIN equipment e ON e.equipment_id = h.equipment_id
        LEFT JOIN slots fs ON fs.slot_id = h.from_slot_id
        LEFT JOIN racks fr ON fr.rack_id = fs.rack_id
        LEFT JOIN warehouses fw ON fw.warehouse_id = fr.warehouse_id
        LEFT JOIN slots ts ON ts.slot_id = h.to_slot_id
        LEFT JOIN racks tr ON tr.rack_id = ts.rack_id
        LEFT JOIN warehouses tw ON tw.warehouse_id = tr.warehouse_id
        LEFT JOIN users u ON u.user_id = h.performed_by
        ${whereSQL}
        `,
        params
      );

      const total = Number(countRows?.[0]?.total || 0);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      const [rows] = await q(
        `
        SELECT
          h.history_id, h.created_at, h.description,
          h.status_before, h.status_after,
          h.equipment_id,
          e.equipment_code, e.equipment_name, e.serial_number,
          c.class_id, c.class_code, c.class_name,

          fs.slot_code AS from_slot_code, fr.rack_code AS from_rack_code, fw.warehouse_code AS from_wh_code, fw.warehouse_name AS from_wh_name,
          ts.slot_code AS to_slot_code, tr.rack_code AS to_rack_code, tw.warehouse_code AS to_wh_code, tw.warehouse_name AS to_wh_name,

          u.user_id AS performed_by_id,
          u.full_name AS performed_by_name
        FROM placement_history h
        JOIN equipment e ON e.equipment_id = h.equipment_id
        JOIN classes c ON c.class_id = e.class_id
        LEFT JOIN slots fs ON fs.slot_id = h.from_slot_id
        LEFT JOIN racks fr ON fr.rack_id = fs.rack_id
        LEFT JOIN warehouses fw ON fw.warehouse_id = fr.warehouse_id
        LEFT JOIN slots ts ON ts.slot_id = h.to_slot_id
        LEFT JOIN racks tr ON tr.rack_id = ts.rack_id
        LEFT JOIN warehouses tw ON tw.warehouse_id = tr.warehouse_id
        LEFT JOIN users u ON u.user_id = h.performed_by
        ${whereSQL}
        ORDER BY h.history_id DESC
        LIMIT ? OFFSET ?
        `,
        [...params, pageSize, offset]
      );

      return ok(res, {
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages,
        rows,
      });
    } catch (e) {
      console.error("HISTORY ERROR:", e);
      return fail(res, "Gagal memuat history");
    }
  }
);

// ============================================================
// REPORT: Placement summary
// GET /api/reports/placements?date_from=&date_to=&warehouse_id=&class_id=&performed_by=
// ============================================================
app.get(
  "/api/reports/placements",
  requireRoles(["admin", "manager"]),
  async (req, res) => {
    try {
      const warehouseId = req.query.warehouse_id ? Number(req.query.warehouse_id) : null;
      const classId = req.query.class_id ? Number(req.query.class_id) : null;
      const performedBy = req.query.performed_by ? Number(req.query.performed_by) : null;
      const dateFrom = String(req.query.date_from || "").trim();
      const dateTo = String(req.query.date_to || "").trim();

      const where = [];
      const params = [];

      if (warehouseId) {
        where.push("(tw.warehouse_id = ? OR fw.warehouse_id = ?)");
        params.push(warehouseId, warehouseId);
      }
      if (classId) {
        where.push("e.class_id = ?");
        params.push(classId);
      }
      if (performedBy) {
        where.push("h.performed_by = ?");
        params.push(performedBy);
      }
      if (dateFrom) {
        where.push("DATE(h.created_at) >= DATE(?)");
        params.push(dateFrom);
      }
      if (dateTo) {
        where.push("DATE(h.created_at) <= DATE(?)");
        params.push(dateTo);
      }

      const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

      // KPI total
      const [kpiRows] = await q(
        `
        SELECT
          COUNT(*) AS total_moves,
          COUNT(DISTINCT h.equipment_id) AS distinct_equipment,
          COUNT(DISTINCT h.performed_by) AS distinct_actors
        FROM placement_history h
        JOIN equipment e ON e.equipment_id = h.equipment_id
        LEFT JOIN slots fs ON fs.slot_id = h.from_slot_id
        LEFT JOIN racks fr ON fr.rack_id = fs.rack_id
        LEFT JOIN warehouses fw ON fw.warehouse_id = fr.warehouse_id
        LEFT JOIN slots ts ON ts.slot_id = h.to_slot_id
        LEFT JOIN racks tr ON tr.rack_id = ts.rack_id
        LEFT JOIN warehouses tw ON tw.warehouse_id = tr.warehouse_id
        ${whereSQL}
        `,
        params
      );

      // summary by warehouse tujuan (to)
      const [byWarehouse] = await q(
        `
        SELECT
          tw.warehouse_id,
          tw.warehouse_code,
          tw.warehouse_name,
          COUNT(*) AS total_moves
        FROM placement_history h
        JOIN equipment e ON e.equipment_id = h.equipment_id
        LEFT JOIN slots ts ON ts.slot_id = h.to_slot_id
        LEFT JOIN racks tr ON tr.rack_id = ts.rack_id
        LEFT JOIN warehouses tw ON tw.warehouse_id = tr.warehouse_id
        LEFT JOIN slots fs ON fs.slot_id = h.from_slot_id
        LEFT JOIN racks fr ON fr.rack_id = fs.rack_id
        LEFT JOIN warehouses fw ON fw.warehouse_id = fr.warehouse_id
        ${whereSQL}
        GROUP BY tw.warehouse_id
        ORDER BY total_moves DESC
        `,
        params
      );

      // summary by class
      const [byClass] = await q(
        `
        SELECT
          c.class_id, c.class_code, c.class_name,
          COUNT(*) AS total_moves
        FROM placement_history h
        JOIN equipment e ON e.equipment_id = h.equipment_id
        JOIN classes c ON c.class_id = e.class_id
        LEFT JOIN slots fs ON fs.slot_id = h.from_slot_id
        LEFT JOIN racks fr ON fr.rack_id = fs.rack_id
        LEFT JOIN warehouses fw ON fw.warehouse_id = fr.warehouse_id
        LEFT JOIN slots ts ON ts.slot_id = h.to_slot_id
        LEFT JOIN racks tr ON tr.rack_id = ts.rack_id
        LEFT JOIN warehouses tw ON tw.warehouse_id = tr.warehouse_id
        ${whereSQL}
        GROUP BY c.class_id
        ORDER BY total_moves DESC
        `,
        params
      );

      return ok(res, {
        kpi: kpiRows?.[0] || { total_moves: 0, distinct_equipment: 0, distinct_actors: 0 },
        by_warehouse_to: byWarehouse,
        by_class: byClass,
      });
    } catch (e) {
      console.error("REPORT PLACEMENTS ERROR:", e);
      return fail(res, "Gagal memuat laporan");
    }
  }
);


// ============================================================
// GLOBAL SEARCH (wajib login)
// ============================================================
app.get(
  "/api/search",
  requireRoles(["admin", "frontdesk", "teknisi", "manager"]),
  async (req, res) => {
    try {
      const qq = String(req.query.q || "").trim();
      if (!qq) return ok(res, { q: "", results: [] });

      const like = `%${qq.slice(0, 60)}%`;

      const [equipment] = await q(
        `
        SELECT
          'equipment' AS type,
          e.equipment_id AS id,
          CONCAT(e.equipment_code, ' — ', e.equipment_name) AS title,
          CONCAT(
            e.readiness_status,
            COALESCE(CONCAT(' · SN: ', e.serial_number), ''),
            COALESCE(CONCAT(' · ', c.class_name), '')
          ) AS subtitle
        FROM equipment e
        JOIN classes c ON c.class_id = e.class_id
        WHERE (
          e.equipment_code LIKE ?
          OR e.equipment_name LIKE ?
          OR COALESCE(e.serial_number,'') LIKE ?
          OR COALESCE(e.brand,'') LIKE ?
          OR COALESCE(e.model,'') LIKE ?
          OR e.readiness_status LIKE ?
          OR c.class_name LIKE ?
          OR c.class_code LIKE ?
        )
        ORDER BY e.equipment_name
        LIMIT 8
        `,
        [like, like, like, like, like, like, like, like]
      );

      const [classes] = await q(
        `
        SELECT
          'class' AS type,
          c.class_id AS id,
          CONCAT(c.class_code, ' — ', c.class_name) AS title,
          COALESCE(c.description, '') AS subtitle
        FROM classes c
        WHERE (
          c.class_code LIKE ?
          OR c.class_name LIKE ?
          OR COALESCE(c.description,'') LIKE ?
        )
        ORDER BY c.class_name
        LIMIT 6
        `,
        [like, like, like]
      );

      const [warehouses] = await q(
        `
        SELECT
          'warehouse' AS type,
          w.warehouse_id AS id,
          CONCAT(w.warehouse_code, ' — ', w.warehouse_name) AS title,
          COALESCE(w.address, '') AS subtitle
        FROM warehouses w
        WHERE (
          w.warehouse_code LIKE ?
          OR w.warehouse_name LIKE ?
          OR COALESCE(w.address,'') LIKE ?
        )
        ORDER BY w.warehouse_name
        LIMIT 6
        `,
        [like, like, like]
      );

      const [racks] = await q(
        `
        SELECT
          'rack' AS type,
          r.rack_id AS id,
          CONCAT(r.rack_code, COALESCE(CONCAT(' · ', r.zone), ''), ' — ', w.warehouse_name) AS title,
          CONCAT('Gudang: ', w.warehouse_code, COALESCE(CONCAT(' · Kapasitas: ', r.capacity), '')) AS subtitle
        FROM racks r
        JOIN warehouses w ON w.warehouse_id = r.warehouse_id
        WHERE (
          r.rack_code LIKE ?
          OR COALESCE(r.zone,'') LIKE ?
          OR w.warehouse_name LIKE ?
          OR w.warehouse_code LIKE ?
        )
        ORDER BY w.warehouse_name, r.rack_code
        LIMIT 8
        `,
        [like, like, like, like]
      );

      const [slots] = await q(
        `
        SELECT
          'slot' AS type,
          s.slot_id AS id,
          CONCAT(s.slot_code, COALESCE(CONCAT(' — ', s.slot_label), '')) AS title,
          CONCAT(
            'Rak: ', r.rack_code,
            COALESCE(CONCAT(' · Zona: ', r.zone), ''),
            ' · Gudang: ', w.warehouse_name
          ) AS subtitle
        FROM slots s
        JOIN racks r ON r.rack_id = s.rack_id
        JOIN warehouses w ON w.warehouse_id = r.warehouse_id
        WHERE (
          s.slot_code LIKE ?
          OR COALESCE(s.slot_label,'') LIKE ?
          OR r.rack_code LIKE ?
          OR COALESCE(r.zone,'') LIKE ?
          OR w.warehouse_name LIKE ?
          OR w.warehouse_code LIKE ?
        )
        ORDER BY w.warehouse_name, r.rack_code, s.slot_code
        LIMIT 10
        `,
        [like, like, like, like, like, like]
      );

      const results = [
        ...equipment.map((x) => ({ ...x, href: `/databarang?focus=${x.id}` })),
        ...classes.map((x) => ({ ...x, href: `/databarang?class_id=${x.id}` })),
        ...warehouses.map((x) => ({ ...x, href: `/lokasi?warehouse_id=${x.id}` })),
        ...racks.map((x) => ({ ...x, href: `/lokasi?rack_id=${x.id}` })),
        ...slots.map((x) => ({ ...x, href: `/lokasi?slot_id=${x.id}` })),
      ];

      return ok(res, { q: qq, results });
    } catch (err) {
      console.error("SEARCH ERROR:", err);
      return fail(res, "Search error");
    }
  }
);

// ============================================================
// ERROR HANDLER (CORS error, dll)
// ============================================================
app.use((err, req, res, next) => {
  console.error("UNHANDLED ERROR:", err);
  return fail(res, err.message || "Server error", 500);
});

// ============================================================
// START SERVER
// ============================================================
const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => {
  console.log(`✅ Backend RDW running on http://localhost:${PORT}`);
  console.log("✅ ENV:", {
    DB_NAME: process.env.DB_NAME,
    DB_PORT: process.env.DB_PORT,
  });
});
