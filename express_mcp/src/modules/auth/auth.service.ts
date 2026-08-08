/**
 * @file auth.service.ts
 * @description Authentication service layer providing JWT token signing and verification logic.
 * 
 * WHY THIS FILE EXISTS:
 * Decouples JWT library details (`jsonwebtoken`) from HTTP controllers and auth middlewares.
 */

import jwt from "jsonwebtoken";
import { AuthUser } from "./auth.dto.js";

/**
 * Secret key used to sign and verify JSON Web Tokens.
 * Reads `JWT_SECRET` environment variable or uses default development fallback.
 */
export const JWT_SECRET = process.env.JWT_SECRET || "express_mcp_super_secret_key_123!";

/**
 * Generates a signed JWT string valid for 7 days containing user identity payload.
 * 
 * @param user Authenticated user identity object.
 * @returns Signed JWT string.
 */
export function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

/**
 * Verifies and decodes a signed JWT token string.
 * Throws error if token is expired, tampered, or invalid.
 * 
 * @param token Raw JWT string.
 * @returns Decoded AuthUser payload object.
 */
export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET) as AuthUser;
}
