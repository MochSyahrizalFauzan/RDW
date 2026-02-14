/**
 * Jalankan script ini untuk setup database di Railway MySQL
 * LOKASI: backend/migrate.js
 * 
 * Cara jalankan:
 * 1. Update .env.local dengan Railway DB credentials
 * 2. Run: node backend/migrate.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  try {
    console.log('🔄 Running migrations...');
    
    // Copy semua CREATE TABLE queries dari database lokal Anda
    // Contoh:
    // await conn.query(`CREATE TABLE IF NOT EXISTS ...`);
    
    console.log('✅ Migrations completed');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await conn.end();
  }
}

migrate();
