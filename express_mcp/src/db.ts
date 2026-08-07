import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root directory regardless of execution cwd
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgres://localhost:5432/postgres",
});
