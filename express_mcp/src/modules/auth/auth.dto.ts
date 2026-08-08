/**
 * @file auth.dto.ts
 * @description Data Transfer Objects (DTOs) and Zod validation schemas for Authentication module.
 * 
 * WHY THIS FILE EXISTS:
 * Ensures runtime validation of request bodies for login and dev token endpoints using Zod schemas,
 * and exports TypeScript interfaces representing authenticated user tokens.
 */

import { z } from "zod";

/**
 * Zod validation schema for user login payload.
 * Enforces valid email format and minimum password length.
 */
export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * TypeScript type inferred from LoginSchema.
 */
export type LoginDto = z.infer<typeof LoginSchema>;

/**
 * Interface representing decoded payload stored within signed JWT Bearer tokens.
 */
export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}
