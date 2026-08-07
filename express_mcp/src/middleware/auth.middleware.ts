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
 * Verifies Authorization: Bearer <token> header.
 * Returns 401 Unauthorized if token is missing, invalid, or expired.
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
      .json({ error: "Unauthorized: Missing Bearer token" });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Invalid or expired token" });
  }
}

/**
 * Optional Authentication Middleware (for Global Chat & Public Routes):
 * Inspects Authorization header if present. Populates req.user if valid, or falls back to guest user context.
 * Never fails with 401.
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
      // If token is invalid or expired, continue as guest/global user
      req.user = undefined;
    }
  } else {
    // Default guest context if no token provided
    req.user = {
      userId: "guest-user",
      email: "guest@example.com",
      role: "guest",
    };
  }

  next();
}
