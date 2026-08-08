/**
 * @file users.dto.ts
 * @description Data Transfer Objects (DTOs) and Zod validation schemas for Users module.
 * 
 * WHY THIS FILE EXISTS:
 * Defines runtime validation schemas for creating users and searching by ID, and exports TypeScript interfaces
 * for database user records (`UserRecord`).
 */

import { z } from "zod";

/**
 * Zod validation schema for creating a new user record.
 */
export const CreateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.string().optional(),
});

/**
 * Zod validation schema for fetching user by UUID parameter.
 */
export const GetUserByIdSchema = z.object({
  id: z.string().min(1, "User ID is required"),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type GetUserByIdDto = z.infer<typeof GetUserByIdSchema>;

/**
 * Interface representing a user record in PostgreSQL database.
 */
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
