import { Pool } from "pg";

// Singleton pool for serverless - optimized for Vercel/Neon
let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    // Support both DATABASE_URL and individual variables
    const connectionString = process.env.DATABASE_URL;
    
    if (connectionString) {
      pool = new Pool({
        connectionString,
        max: 3,
        ssl: { rejectUnauthorized: false },
      });
    } else {
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
  }
  return pool;
}

// Helper: Convert MySQL ? to PostgreSQL $n
export function sql(query: string): string {
  let i = 0;
  return query.replace(/\?/g, () => `$${++i}`);
}

// CORS headers
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
