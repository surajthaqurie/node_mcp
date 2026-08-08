/**
 * @file auth.middleware.ts
 * @description Express authentication middlewares for handling JWT Bearer token validation.
 * 
 * WHY THIS FILE EXISTS:
 * Provides two middleware functions (`authMiddleware` and `optionalAuthMiddleware`) to protect routes and extract identity metadata
 * from incoming HTTP Authorization headers, attaching decoded `AuthUser` data to `req.user`.
 */

import { Request, Response, NextFunction } from "express";
import { AuthUser } from "../modules/auth/auth.dto.js";
import { verifyToken } from "../modules/auth/auth.service.js";

/**
 * Extended Express Request interface attaching decoded authenticated user context.
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

/**
 * Strict Authentication Middleware:
 * 
 * WHY:
 * Protects authenticated routes (e.g. `/api/tasks`, `/api/chat/authenticated`, `/mcp`).
 * Verifies `Authorization: Bearer <token>` header against JWT secret.
 * Returns HTTP 401 Unauthorized if token is missing, invalid, or expired.
 */
export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

  if (!token) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Missing Bearer token in Authorization header" });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Invalid or expired Bearer token" });
  }
}

/**
 * Optional Authentication Middleware:
 * 
 * WHY:
 * Supports global endpoints (e.g. `/api/chat`) that accept both authenticated and unauthenticated guest requests.
 * If a valid Bearer token is provided, populates `req.user` with decoded user identity.
 * If token is omitted or invalid, assigns default guest context (`userId: "guest-user"`).
 * Never fails with HTTP 401.
 */
export function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

  if (token) {
    try {
      const decoded = verifyToken(token);
      req.user = decoded;
    } catch {
      // If token is invalid or expired, fall back to guest session
      req.user = undefined;
    }
  } else {
    // Default guest user context
    req.user = {
      userId: "guest-user",
      email: "guest@example.com",
      role: "guest",
    };
  }

  next();
}
