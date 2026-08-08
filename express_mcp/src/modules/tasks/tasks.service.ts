/**
 * @file tasks.service.ts
 * @description Task database service providing SQL query executions for tasks CRUD operations and reporting aggregations.
 * 
 * WHY THIS FILE EXISTS:
 * Encapsulates PostgreSQL database logic for creating, listing, updating, soft-deleting, and reporting on task entities.
 * Automatically initializes and migrates `tasks` table schema on first query execution.
 */

import { pool } from "../../db.js";
import { TaskRecord } from "./tasks.dto.js";
import { PaginatedResponse } from "../users/users.service.js";

let tableInitialized = false;

/**
 * Service Helper: Creates tasks table if it does not exist and ensures necessary column schemas.
 */
async function ensureTaskTableSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      user_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP WITH TIME ZONE,
      deleted_by VARCHAR(255)
    );
  `);

  await pool.query(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);
  `);

  await pool.query(`
    UPDATE tasks
    SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
        updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
    WHERE created_at IS NULL OR updated_at IS NULL;
  `);
}

/**
 * Service Helper: Lazy initialization guard for task database schema.
 */
export async function initTasksTable() {
  if (tableInitialized) return;
  try {
    await ensureTaskTableSchema();
    tableInitialized = true;
  } catch (err: any) {
    console.error("Tasks table initialization error:", err.message);
  }
}

/**
 * Service: Inserts a new task record bound to a specific user.
 * 
 * @param data Object containing title, description, status, and userId.
 * @returns Created TaskRecord object.
 */
export async function createTask(data: {
  title: string;
  description?: string;
  status?: string;
  userId: string;
}): Promise<TaskRecord> {
  await initTasksTable();
  const status = data.status || "PENDING";
  const result = await pool.query(
    `INSERT INTO tasks (title, description, status, user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, description, status, user_id AS "userId", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [data.title, data.description || null, status, data.userId],
  );
  return result.rows[0];
}

/**
 * Service: Retrieves paginated task records owned by a user with optional status filter.
 * 
 * @param userId Owner user ID filter.
 * @param status Optional task status filter ("PENDING", "IN_PROGRESS", "COMPLETED").
 * @param page Target page number (1-indexed).
 * @param limit Items per page.
 * @returns Paginated result object containing task array and metadata.
 */
export async function getTasks(
  userId: string,
  status?: string,
  page: number = 1,
  limit: number = 10,
): Promise<PaginatedResponse<TaskRecord>> {
  await initTasksTable();
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const offset = (safePage - 1) * safeLimit;

  let countQuery = `SELECT COUNT(*) FROM tasks WHERE user_id = $1 AND deleted_at IS NULL`;
  const countParams: any[] = [userId];
  if (status) {
    countQuery += ` AND status = $2`;
    countParams.push(status);
  }
  const countResult = await pool.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(total / safeLimit) || 1;

  let dataQuery = `SELECT id, title, description, status, user_id AS "userId", created_at AS "createdAt", updated_at AS "updatedAt" FROM tasks WHERE user_id = $1 AND deleted_at IS NULL`;
  const dataParams: any[] = [userId];

  if (status) {
    dataQuery += ` AND status = $2`;
    dataParams.push(status);
  }

  dataQuery += ` ORDER BY created_at DESC LIMIT $${dataParams.length + 1} OFFSET $${dataParams.length + 2}`;
  dataParams.push(safeLimit, offset);

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
 * Service: Updates the status of an existing active task.
 * 
 * @param id Task UUID string.
 * @param status New target status string.
 * @param userId Authenticated owner user ID.
 * @returns Updated TaskRecord or null if task not found or access denied.
 */
export async function updateTaskStatus(
  id: string,
  status: string,
  userId: string,
): Promise<TaskRecord | null> {
  await initTasksTable();
  const result = await pool.query(
    `UPDATE tasks
     SET status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
     RETURNING id, title, description, status, user_id AS "userId", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [status, id, userId],
  );
  return result.rows[0] || null;
}

/**
 * Service: Soft-deletes a task by setting `deleted_at` timestamp.
 * 
 * @param id Task UUID string.
 * @param userId Owner user ID performing deletion.
 * @returns Boolean true if task was soft deleted, false otherwise.
 */
export async function deleteTask(id: string, userId: string): Promise<boolean> {
  await initTasksTable();
  const result = await pool.query(
    `UPDATE tasks
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Service: Aggregates active task counts grouped by user for reporting/admin dashboards.
 * 
 * @returns Array of objects containing userId and active taskCount.
 */
export async function getTaskCountsByUser(): Promise<
  Array<{ userId: string; taskCount: number }>
> {
  await initTasksTable();
  const result = await pool.query(
    `SELECT user_id AS "userId", COUNT(*)::int AS "taskCount"
     FROM tasks
     WHERE deleted_at IS NULL
     GROUP BY user_id
     ORDER BY "taskCount" DESC, "userId" ASC`,
  );
  return result.rows;
}

/**
 * Service: Aggregates soft-deleted task counts grouped by user.
 * 
 * @returns Array of objects containing userId and deletedTaskCount.
 */
export async function getDeletedTaskCountsByUser(): Promise<
  Array<{ userId: string; deletedTaskCount: number }>
> {
  await initTasksTable();
  const result = await pool.query(
    `SELECT user_id AS "userId", COUNT(*)::int AS "deletedTaskCount"
     FROM tasks
     WHERE deleted_at IS NOT NULL
     GROUP BY user_id
     ORDER BY "deletedTaskCount" DESC, "userId" ASC`,
  );
  return result.rows;
}
