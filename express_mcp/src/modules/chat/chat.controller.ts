/**
 * @file chat.controller.ts
 * @description HTTP controllers for AI Chat endpoints (`/api/chat` and `/api/chat/authenticated`).
 * 
 * WHY THIS FILE EXISTS:
 * Handles incoming chat messages from both public/guest sessions and authenticated users,
 * connects to user-scoped MCP tools, invokes the LLM processing engine, and returns formatted content blocks.
 */

import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { createMcpServer } from "../../mcp/mcp.server.js";
import { processChat } from "../../llm.js";
import { formatNativeAssistantResponse } from "../../utils/index.js";

/**
 * Controller: Global AI Chat (`POST /api/chat`).
 * 
 * WHY:
 * Accepts public or guest chat prompts. If a Bearer token is attached, populates user identity;
 * otherwise proceeds with a guest context.
 * 
 * @param req Request containing `{ message: string }` in body.
 * @param res Response returning formatted JSON content blocks.
 */
export async function globalChatController(req: AuthenticatedRequest, res: Response) {
  const { message } = req.body;
  if (typeof message !== "string") {
    return res
      .status(400)
      .json({ error: "Invalid message format: expected string" });
  }

  try {
    const userServer = createMcpServer(req.user);
    const tools = (userServer as any)._registeredTools;
    const aiResponse = await processChat(message, tools, {
      userId: req.user?.userId,
    });
    return res.json(formatNativeAssistantResponse(aiResponse));
  } catch (err: any) {
    return res.status(500).json({ error: `AI Processing Error: ${err.message}` });
  }
}

/**
 * Controller: Authenticated AI Chat (`POST /api/chat/authenticated`).
 * 
 * WHY:
 * Enforces strict JWT token authentication before processing chat messages to execute user-scoped database actions.
 * 
 * @param req Authenticated Request containing verified `req.user` and `{ message: string }` in body.
 * @param res Response returning formatted JSON content blocks.
 */
export async function authenticatedChatController(req: AuthenticatedRequest, res: Response) {
  const { message } = req.body;
  if (typeof message !== "string") {
    return res
      .status(400)
      .json({ error: "Invalid message format: expected string" });
  }

  try {
    const userServer = createMcpServer(req.user);
    const tools = (userServer as any)._registeredTools;
    const aiResponse = await processChat(message, tools, {
      userId: req.user?.userId,
    });
    return res.json(formatNativeAssistantResponse(aiResponse));
  } catch (err: any) {
    return res.status(500).json({ error: `AI Processing Error: ${err.message}` });
  }
}
