/**
 * @file runner.ts
 * @description Automatic database initialization and SQL migration runner for Express MCP.
 * 
 * WHY THIS FILE EXISTS:
 * Ensures PostgreSQL target database exists (creates target database automatically if missing) and executes
 * pending `.sql` schema migration files in order while recording execution history in `schema_migrations`.
 * 
 * RUN COMMAND:
 * `npm run db:migrate` or `npx tsx src/migrations/runner.ts`
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client, Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Checks if target database specified in connection string exists.
 * If missing, connects to default 'postgres' database and executes `CREATE DATABASE`.
 * 
 * @param dbUrl PostgreSQL connection URL string.
 */
async function ensureDatabaseExists(dbUrl: string) {
  const parsedUrl = new URL(dbUrl);
  const urlDbName = parsedUrl.pathname.replace(/^\//, "");
  
  const dbName =
    urlDbName && urlDbName !== "postgres"
      ? urlDbName
      : process.env.DB_NAME || process.env.DATABASE_NAME;

  if (!dbName) {
    throw new Error(
      "❌ Fatal: No database name specified! Please provide a database in DATABASE_URL or set DB_NAME in .env"
    );
  }

  if (dbName === "postgres") {
    return; // System postgres database
  }

  // Connect to default 'postgres' system database to check/create target database
  const systemUrl = new URL(dbUrl);
  systemUrl.pathname = "/postgres";

  const client = new Client({ connectionString: systemUrl.toString() });
  await client.connect();

  try {
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (res.rowCount === 0) {
      console.log(`🔍 Database '${dbName}' does not exist. Creating database...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✨ Database '${dbName}' created successfully!`);
    } else {
      console.log(`✅ Database '${dbName}' exists.`);
    }
  } finally {
    await client.end();
  }
}

/**
 * Reads, verifies, and executes unapplied SQL migration files in numeric order within transactional blocks.
 */
async function runMigrations() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error("❌ Fatal Error: DATABASE_URL is not defined in environment variables or .env file.");
    process.exit(1);
  }

  console.log("🚀 Starting database migrations...");

  // 1. Ensure target database exists based on DATABASE_URL
  await ensureDatabaseExists(dbUrl);

  const pool = new Pool({ connectionString: dbUrl });

  try {
    // 2. Create schema_migrations tracking table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Fetch already applied migrations
    const { rows } = await pool.query("SELECT filename FROM schema_migrations");
    const executedFiles = new Set(rows.map((r) => r.filename));

    // 4. Read migration SQL files
    const files = fs
      .readdirSync(__dirname)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (executedFiles.has(file)) {
        console.log(`⏳ Skipping already executed migration: ${file}`);
        continue;
      }

      console.log(`▶ Executing migration: ${file}`);
      const filePath = path.join(__dirname, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`✅ Applied migration: ${file}`);
        count++;
      } catch (err: any) {
        await client.query("ROLLBACK");
        console.error(`❌ Migration failed [${file}]:`, err.message);
        process.exit(1);
      } finally {
        client.release();
      }
    }

    console.log(`🎉 Migration complete! Applied ${count} new migration(s).`);
  } catch (err: any) {
    console.error("Migration runner failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
