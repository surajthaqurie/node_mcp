import jwt from "jsonwebtoken";
import { AuthUser } from "./auth.dto.js";

export const JWT_SECRET = process.env.JWT_SECRET || "express_mcp_super_secret_key_123!";

export function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET) as AuthUser;
}
