/**
 * @file auth.routes.ts
 * @description Express router declaring HTTP routes for Authentication module (`/api/auth`).
 * 
 * WHY THIS FILE EXISTS:
 * Defines endpoint paths (`/login`, `/token`) and maps HTTP POST requests to corresponding controller functions.
 */

import { Router } from "express";
import { loginController, generateDevTokenController } from "./auth.controller.js";

export const authRouter = Router();

/**
 * @route POST /api/auth/login
 * @description Validates credentials and returns signed JWT Bearer token.
 */
authRouter.post("/login", loginController);

/**
 * @route POST /api/auth/token
 * @description Development token generator for custom user testing.
 */
authRouter.post("/token", generateDevTokenController);
