import { pool } from "../../db.js";
import { TaskRecord } from "./tasks.dto.js";
import { PaginatedResponse } from "../users/users.service.js";

let tableInitialized = false;

/**
 * Service Helper: Ensures the 'tasks' table exists in PostgreSQL database.
 */
export async function initTasksTable() {
  if (tableInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    tableInitialized = true;
  } catch (err: any) {
    console.error("Tasks table initialization error:", err.message);
  }
}

/**
 * Service: Inserts a new task owned by the specified user into PostgreSQL.
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
    [data.title, data.description || null, status, data.userId]
  );
  return result.rows[0];
}

/**
 * Service: Fetches paginated tasks owned by a specific user with optional status filter.
 */
export async function getTasks(
  userId: string,
  status?: string,
  page: number = 1,
  limit: number = 10
): Promise<PaginatedResponse<TaskRecord>> {
  await initTasksTable();
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const offset = (safePage - 1) * safeLimit;

  let countQuery = `SELECT COUNT(*) FROM tasks WHERE user_id = $1`;
  const countParams: any[] = [userId];
  if (status) {
    countQuery += ` AND status = $2`;
    countParams.push(status);
  }
  const countResult = await pool.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(total / safeLimit) || 1;

  let dataQuery = `SELECT id, title, description, status, user_id AS "userId", created_at AS "createdAt", updated_at AS "updatedAt" FROM tasks WHERE user_id = $1`;
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
 * Service: Updates status of a task for a given user.
 */
export async function updateTaskStatus(id: string, status: string, userId: string): Promise<TaskRecord | null> {
  await initTasksTable();
  const result = await pool.query(
    `UPDATE tasks
     SET status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND user_id = $3
     RETURNING id, title, description, status, user_id AS "userId", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [status, id, userId]
  );
  return result.rows[0] || null;
}

/**
 * Service: Removes a task by ID owned by the given user.
 */
export async function deleteTask(id: string, userId: string): Promise<boolean> {
  await initTasksTable();
  const result = await pool.query(
    `DELETE FROM tasks WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
}
