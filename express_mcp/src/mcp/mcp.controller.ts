/**
 * @file mcp.controller.ts
 * @description HTTP controllers for Model Context Protocol (MCP) transport endpoints.
 *
 * WHY THIS FILE EXISTS:
 * Isolates MCP-specific handler logic from the main server bootstrap file.
 * Handles:
 * - `POST /mcp` — JSON-RPC 2.0 request processing over Streamable HTTP Transport.
 * - `GET /mcp` and `DELETE /mcp` — Explicit 405 rejection for unsupported methods.
 * - `GET /health` — Simple healthcheck response.
 */

import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { createMcpServer } from "./mcp.server.js";

/**
 * Controller: MCP JSON-RPC 2.0 over Streamable HTTP Transport (`POST /mcp`).
 *
 * WHY:
 * Accepts MCP JSON-RPC calls from external clients (e.g. Claude Desktop, Cursor, custom MCP agents).
 * Each request creates an isolated per-request McpServer instance scoped to the verified user identity.
 *
 * HOW IT WORKS:
 * 1. Creates a fresh `McpServer` bound to `req.user` for user-scoped tool execution.
 * 2. Initialises a `StreamableHTTPServerTransport` in stateless mode (no session persistence).
 * 3. Connects server to transport, processes the JSON-RPC request body, streams response.
 * 4. Closes server and transport when HTTP response is finalised.
 *
 * @param req Authenticated request with `req.user` populated by `authMiddleware`.
 * @param res Express Response object.
 */
export async function mcpHttpController(
  req: AuthenticatedRequest,
  res: express.Response,
) {
  // Isolated MCP server instance per request, scoped to authenticated user
  const server = createMcpServer(req.user);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless — no session stored between requests
  });

  // Release resources when HTTP response socket closes
  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request handling failed:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}

/**
 * Controller: Method Not Allowed handler for `GET /mcp` and `DELETE /mcp`.
 *
 * WHY:
 * Stateless HTTP MCP transport only accepts POST requests. GET and DELETE are explicitly
 * rejected with a JSON-RPC 2.0 compliant 405 error response to satisfy the MCP spec.
 */
export function mcpMethodNotAllowedController(
  _req: express.Request,
  res: express.Response,
) {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed. Stateless transport only supports POST.",
    },
    id: null,
  });
}

/**
 * Controller: Server healthcheck (`GET /health`).
 *
 * WHY:
 * Used by container orchestrators (Docker, Kubernetes), load balancers, and uptime monitors
 * to verify that the Express server process is alive and handling requests.
 */
export function healthController(
  _req: express.Request,
  res: express.Response,
) {
  res.json({ ok: true });
}
