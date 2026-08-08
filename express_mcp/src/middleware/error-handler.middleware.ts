/**
 * @file error-handler.middleware.ts
 * @description Centralized Express error handling middleware.
 * 
 * WHY THIS FILE EXISTS:
 * Serves as the ultimate error boundary in Express, catching unhandled exceptions or rejected promises
 * and returning standardized JSON error payloads to clients while logging error traces to console.
 */

import { Request, Response, NextFunction } from "express";

/**
 * Express error middleware signature (4 parameters).
 */
export function errorHandlerMiddleware(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error("Unhandled Application Error:", err);
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  return res.status(status).json({ error: message });
}
