/**
 * @file auth.controller.ts
 * @description HTTP controllers for Authentication endpoints (`/api/auth/login`, `/api/auth/token`).
 * 
 * WHY THIS FILE EXISTS:
 * Processes incoming HTTP requests, validates request payloads with Zod schemas, invokes auth services,
 * and formats HTTP responses.
 */

import { Request, Response } from "express";
import { LoginSchema } from "./auth.dto.js";
import { generateToken } from "./auth.service.js";

/**
 * Controller: Handles user login (`POST /api/auth/login`).
 * 
 * WHY:
 * Validates login credentials against LoginSchema and generates a signed JWT token.
 * 
 * @param req Express Request object containing email & password in body.
 * @param res Express Response object returning JSON payload with JWT token.
 */
export async function loginController(req: Request, res: Response) {
  const parseResult = LoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.issues[0].message });
  }

  const { email } = parseResult.data;
  const token = generateToken({
    userId: `user_${Date.now()}`,
    email,
    role: "user",
  });

  return res.json({
    message: "Login successful",
    token,
  });
}

/**
 * Controller: Generates a development JWT token (`POST /api/auth/token`).
 * 
 * WHY:
 * Facilitates quick development testing of authenticated REST endpoints and MCP routes by generating
 * custom user-scoped JWT tokens without requiring real credentials or database records.
 * 
 * @param req Request containing userId, email, and optional role.
 * @param res Response containing generated dev Bearer token.
 */
export async function generateDevTokenController(req: Request, res: Response) {
  const { userId, email, role } = req.body;
  if (!userId || !email) {
    return res.status(400).json({ error: "userId and email are required" });
  }

  const token = generateToken({
    userId,
    email,
    role: role || "user",
  });

  return res.json({ token, message: "Use this token in Authorization: Bearer <token>" });
}
