/**
 * Migration script untuk PostgreSQL (Neon)
 * 
 * Cara pakai:
 * 1. Update .env.local dengan credentials Neon
 * 2. Run: node backend/migrate-pg.js
 * 
 * Script ini akan create semua tables sesuai schema.sql
 */

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: { rejectUnauthorized: false }, // Neon requires SSL
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("🔄 Running migrations...");

    // Read schema.sql
    const schemaPath = path.join(__dirname, "schema.sql");
    if (!fs.existsSync(schemaPath)) {
      throw new Error("schema.sql tidak ditemukan di backend folder");
    }

    const schema = fs.readFileSync(schemaPath, "utf-8");

    // Split queries (pisahkan by ;)
    const queries = schema
      .split(";")
      .map((q) => q.trim())
      .filter((q) => q.length > 0);

    for (const query of queries) {
      console.log(`✓ Executing query...`);
      await client.query(query);
    }

    console.log("✅ Migrations completed successfully!");

    // Show tables created
    const result = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    console.log("\n📊 Tables created:");
    result.rows.forEach((row) => {
      console.log(`  - ${row.table_name}`);
    });
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

migrate();
