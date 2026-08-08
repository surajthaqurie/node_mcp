/**
 * create-database.ts
 * -------------------
 * Connects to the default `postgres` database and creates
 * the target database (from DATABASE_URL) if it doesn't exist.
 *
 * Run: npm run db:create
 */

import 'dotenv/config';
import { Client } from 'pg';

async function createDatabaseIfNotExists(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set in environment variables.');
    process.exit(1);
  }

  // Parse the target database name from the URL
  // e.g. postgres://postgres:root@localhost:5432/nest_mcp → nest_mcp
  const url = new URL(databaseUrl);
  const targetDb = url.pathname.replace('/', '');

  if (!targetDb) {
    console.error('❌ Could not extract database name from DATABASE_URL.');
    process.exit(1);
  }

  // Connect to the default `postgres` maintenance database
  const client = new Client({
    host: url.hostname,
    port: Number(url.port) || 5432,
    user: url.username,
    password: url.password,
    database: 'postgres',
  });

  try {
    await client.connect();

    // Check if the database already exists
    const result = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists`,
      [targetDb],
    );

    if (result.rows[0].exists) {
      console.log(`ℹ️  Database "${targetDb}" already exists — skipping.`);
    } else {
      // pg does not support CREATE DATABASE inside a transaction,
      // so we use a raw query directly.
      await client.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`✅ Database "${targetDb}" created successfully.`);
    }
  } catch (error) {
    console.error('❌ Failed to create database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

void createDatabaseIfNotExists();
