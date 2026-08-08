/**
 * @file server.ts
 * @description Main application entry point for Express MCP Server.
 *
 * WHY THIS FILE EXISTS:
 * Bootstraps the Express HTTP server: applies global middleware, mounts all routers,
 * registers Swagger OpenAPI documentation, and attaches the centralized error handler.
 *
 * ARCHITECTURE SUMMARY:
 * 1. Express REST Architecture — Modular controller-service pattern (auth, users, tasks, chat).
 * 2. Model Context Protocol (MCP) — JSON-RPC 2.0 over Streamable HTTP Transport (`/mcp`).
 * 3. AI Chat System — LLMs (Google Gemini / Ollama) connected to MCP tools with token tracking.
 * 4. OpenAPI / Swagger Docs — Dynamic UI at `/api-docs` documenting all REST & MCP endpoints.
 *
 * ROUTE MAP:
 * - `/api/auth/**`          -> Auth REST routes (authRouter)
 * - `/api/tasks/**`         -> Task CRUD REST routes (tasksRouter)
 * - `/api/users/**`         -> User management REST routes (usersRouter)
 * - `/api/chat/**`          -> AI Chat routes — public & authenticated (chatRouter)
 * - `/mcp`                  -> MCP Streamable HTTP JSON-RPC endpoint (mcpRouter)
 * - `/health`               -> Server healthcheck (mcpRouter)
 * - `/api-docs`             -> Swagger UI (setupSwagger)
 */

import express from "express";
import cors from "cors";
import { setupSwagger } from "./swagger.js";
import { errorHandlerMiddleware } from "./middleware/error-handler.middleware.js";
import { apiRouter } from "./modules/index.js";
import { mcpRouter } from "./mcp/mcp.routes.js";
import { createMcpServer } from "./mcp/mcp.server.js";

// ─── Initialize Express Application ──────────────────────────────────────────
const app = express();

// Apply global middleware: allow cross-origin requests & parse JSON request bodies
app.use(cors());
app.use(express.json());

// ─── Mount Routers ────────────────────────────────────────────────────────────
// REST API modules (auth, tasks, users, chat) under /api prefix
app.use("/api", apiRouter);

// MCP Streamable HTTP transport + /health endpoint (no prefix — mounted at root)
app.use(mcpRouter);

// ─── Swagger OpenAPI Docs ─────────────────────────────────────────────────────
// Dynamically registers REST wrappers for all MCP tools, prompts, and resources
// and serves interactive Swagger UI at /api-docs
const swaggerServer = createMcpServer();
setupSwagger(app, swaggerServer);

// ─── Centralized Error Handler ────────────────────────────────────────────────
// Must be registered after all routes — catches any unhandled errors from async handlers
app.use(errorHandlerMiddleware);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () =>
  console.log(
    `Express MCP server successfully running on http://localhost:${PORT}`,
  ),
);
