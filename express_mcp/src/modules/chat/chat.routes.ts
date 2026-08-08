/**
 * @file chat.routes.ts
 * @description Express router declaring HTTP routes for AI Chat module (`/api/chat`).
 *
 * WHY THIS FILE EXISTS:
 * Binds chat endpoints to their controller functions and attaches appropriate auth middleware:
 * - `POST /api/chat`               -> Public / guest-accessible global chat (optional auth).
 * - `POST /api/chat/authenticated` -> Strictly authenticated chat (JWT Bearer required).
 */

import { Router } from "express";
import {
  globalChatController,
  authenticatedChatController,
} from "./chat.controller.js";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../../middleware/auth.middleware.js";

export const chatRouter = Router();

/**
 * @route POST /api/chat
 * @description Global AI Chat endpoint — accepts requests with or without a JWT Bearer token.
 *              Guest users receive a shared tool context; authenticated users get a user-scoped context.
 */
chatRouter.post("/", optionalAuthMiddleware, globalChatController);

/**
 * @route POST /api/chat/authenticated
 * @description Strictly authenticated AI Chat — requires a valid JWT Bearer token.
 *              All MCP tool calls are executed under the verified user's identity.
 */
chatRouter.post("/authenticated", authMiddleware, authenticatedChatController);
