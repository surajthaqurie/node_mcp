/**
 * @file db.ts
 * @description PostgreSQL database pool configuration and connection provider.
 * 
 * WHY THIS FILE EXISTS:
 * Manages the node-postgres (`pg`) database connection pool shared across all REST services and MCP tool handlers.
 * Ensures environment variables are reliably loaded from `.env` regardless of execution directory.
 * 
 * USAGE:
 * Import `pool` to execute parameterized SQL queries across controllers and MCP tool handlers:
 * `const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);`
 */

import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root directory regardless of execution current working directory
dotenv.config({ path: path.resolve(__dirname, "../.env") });

/**
 * Shared PostgreSQL connection pool instance.
 * Reads `DATABASE_URL` from environment or defaults to `postgres://localhost:5432/postgres`.
 */
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgres://localhost:5432/postgres",
});
