import { Request, Response } from "express";
import { LoginSchema } from "./auth.dto.js";
import { generateToken } from "./auth.service.js";

/**
 * Controller: Handles user login.
 * Validates request payload against LoginSchema and generates a signed JWT token.
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
 * Controller: Generates a development JWT token with custom user details.
 * Useful for testing authenticated REST & MCP endpoints in development.
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
