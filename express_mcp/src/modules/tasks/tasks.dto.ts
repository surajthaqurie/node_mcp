/**
 * @file tasks.dto.ts
 * @description Data Transfer Objects (DTOs) and Zod validation schemas for Task module.
 * 
 * WHY THIS FILE EXISTS:
 * Defines runtime validation schemas for creating and updating tasks, and exports TypeScript interfaces
 * for database task records (`TaskRecord`).
 */

import { z } from "zod";

/**
 * Zod validation schema for creating a new task.
 */
export const CreateTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional().default("PENDING"),
});

/**
 * Zod validation schema for updating task status.
 */
export const UpdateTaskStatusSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]),
});

export type CreateTaskDto = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskStatusDto = z.infer<typeof UpdateTaskStatusSchema>;

/**
 * Interface representing a task record in PostgreSQL database.
 */
export interface TaskRecord {
  id: string;
  title: string;
  description?: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
