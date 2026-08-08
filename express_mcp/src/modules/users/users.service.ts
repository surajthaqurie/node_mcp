/**
 * @file users.service.ts
 * @description User service providing SQL queries and pagination logic for user record management.
 * 
 * WHY THIS FILE EXISTS:
 * Handles direct PostgreSQL interactions for creating users, fetching paginated user lists with search filter clauses,
 * and fetching user profiles by ID. Automatically handles lazy initialization of the `users` database table.
 */

import { pool } from "../../db.js";
import { CreateUserDto, UserRecord } from "./users.dto.js";

let tableInitialized = false;

/**
 * Generic Interface for Paginated API and Service responses.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Service Helper: Ensures the 'users' table exists in PostgreSQL database.
 */
export async function initUsersTable() {
  if (tableInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    tableInitialized = true;
  } catch (err: any) {
    console.error("Users table initialization error:", err.message);
  }
}

/**
 * Helper to build parameterized SQL WHERE clauses for user search queries.
 * 
 * @param query Search query text string.
 * @param searchBy Scope ("name", "email", or "all").
 * @returns Object containing `whereClause` string and parameterized array.
 */
export function buildUserSearchClause(query?: string, searchBy?: string) {
  const trimmedQuery = query?.trim();
  if (!trimmedQuery) {
    return { whereClause: "", params: [] as string[] };
  }

  const likeQuery = `%${trimmedQuery}%`;

  if (searchBy === "name") {
    return { whereClause: " AND name ILIKE $1", params: [likeQuery] };
  }

  if (searchBy === "email") {
    return { whereClause: " AND email ILIKE $1", params: [likeQuery] };
  }

  return {
    whereClause: " AND (name ILIKE $1 OR email ILIKE $1)",
    params: [likeQuery],
  };
}

/**
 * Service: Retrieves paginated user records from PostgreSQL with optional text search filtering.
 * 
 * @param page Target page number (1-indexed).
 * @param limit Number of records per page.
 * @param query Optional search query string.
 * @param searchBy Scope of search ("name", "email", "all").
 * @returns Paginated result containing users array and pagination metadata.
 */
export async function getAllUsers(
  page: number = 1,
  limit: number = 10,
  query?: string,
  searchBy?: string,
): Promise<PaginatedResponse<UserRecord>> {
  await initUsersTable();
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const offset = (safePage - 1) * safeLimit;
  const { whereClause, params } = buildUserSearchClause(query, searchBy);

  const countQuery = `SELECT COUNT(*) FROM users WHERE 1 = 1${whereClause}`;
  const countParams = [...params];
  const countResult = await pool.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(total / safeLimit) || 1;

  const dataQuery = `SELECT * FROM users WHERE 1 = 1${whereClause} ORDER BY created_at DESC LIMIT $${countParams.length + 1} OFFSET $${countParams.length + 2}`;
  const dataParams = [...countParams, safeLimit, offset];
  const dataResult = await pool.query(dataQuery, dataParams);

  return {
    data: dataResult.rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
    },
  };
}

/**
 * Service: Finds a single user by UUID primary key.
 * 
 * @param id User UUID string.
 * @returns UserRecord or null if user does not exist.
 */
export async function getUserById(id: string): Promise<UserRecord | null> {
  await initUsersTable();
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
}

/**
 * Service: Inserts a new user record into PostgreSQL.
 * 
 * @param data CreateUserDto payload containing name, email, and optional role.
 * @returns Newly inserted UserRecord.
 */
export async function createUser(data: CreateUserDto): Promise<UserRecord> {
  await initUsersTable();
  let result;
  try {
    result = await pool.query(
      "INSERT INTO users (name, email, role) VALUES ($1, $2, $3) RETURNING *",
      [data.name, data.email, data.role || "user"],
    );
  } catch (err: any) {
    if (err.code === "42703") {
      result = await pool.query(
        "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
        [data.name, data.email],
      );
    } else {
      throw err;
    }
  }
  return result.rows[0];
}
