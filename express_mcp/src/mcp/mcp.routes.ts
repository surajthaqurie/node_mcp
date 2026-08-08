/**
 * @file mcp.routes.ts
 * @description Express router for MCP Streamable HTTP Transport and system health routes.
 *
 * WHY THIS FILE EXISTS:
 * Separates MCP protocol route declarations from the main server bootstrap file,
 * keeping `server.ts` clean and focused on wiring middleware and sub-routers.
 *
 * ROUTES DECLARED:
 * - `POST /mcp`   -> Authenticated MCP JSON-RPC 2.0 request handler.
 * - `GET /mcp`    -> 405 Method Not Allowed (stateless transport, no sessions).
 * - `DELETE /mcp` -> 405 Method Not Allowed.
 * - `GET /health` -> Server healthcheck.
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  mcpHttpController,
  mcpMethodNotAllowedController,
  healthController,
} from "./mcp.controller.js";

export const mcpRouter = Router();

/**
 * @route POST /mcp
 * @description MCP JSON-RPC 2.0 entrypoint. Requires JWT Bearer token via authMiddleware.
 */
mcpRouter.post("/mcp", authMiddleware, mcpHttpController);

/**
 * @route GET /mcp
 * @description Explicitly disallowed — stateless HTTP transport does not support GET.
 */
mcpRouter.get("/mcp", mcpMethodNotAllowedController);

/**
 * @route DELETE /mcp
 * @description Explicitly disallowed — stateless HTTP transport does not support DELETE.
 */
mcpRouter.delete("/mcp", mcpMethodNotAllowedController);

/**
 * @route GET /health
 * @description Returns `{ ok: true }` when the server is running and ready to accept traffic.
 */
mcpRouter.get("/health", healthController);
