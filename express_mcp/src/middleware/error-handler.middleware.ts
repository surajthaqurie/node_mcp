import { Request, Response, NextFunction } from "express";

export function errorHandlerMiddleware(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error("Unhandled Application Error:", err);
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  return res.status(status).json({ error: message });
}
