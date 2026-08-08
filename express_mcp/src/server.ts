/**
 * @file server.ts
 * @description Main application entry point for Express MCP Server.
 * 
 * WHY THIS FILE EXISTS:
 * This file bootstraps the Express HTTP server, mounts REST API routers (`/api/auth`, `/api/tasks`, `/api/users`),
 * exposes Model Context Protocol endpoints over Streamable HTTP Transport (`/mcp`), provides global & authenticated AI Chat endpoints,
 * configures Swagger OpenAPI documentation, and applies centralized error handling.
 * 
 * ARCHITECTURE SUMMARY:
 * 1. Express REST Architecture: Modular controller-service pattern for auth, users, and tasks.
 * 2. Model Context Protocol (MCP) Server: Exposes database tools, prompts, and resources over JSON-RPC 2.0.
 * 3. AI Chat System: Connects LLMs (Google Gemini / Ollama) to MCP tools dynamically with session context & token usage tracking.
 * 4. OpenAPI / Swagger Docs: Dynamic auto-generated UI documenting REST endpoints and interactive MCP tools.
 */

import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { setupSwagger } from "./swagger.js";
import cors from "cors";
import { processChat } from "./llm.js";
import {
  authMiddleware,
  optionalAuthMiddleware,
  AuthenticatedRequest,
} from "./middleware/auth.middleware.js";
import { errorHandlerMiddleware } from "./middleware/error-handler.middleware.js";
import { apiRouter } from "./modules/index.js";
import { createMcpServer } from "./mcp/mcp.server.js";
import { formatNativeAssistantResponse } from "./utils/index.js";

// Initialize Express Application
const app = express();

// Apply Global Middleware: CORS for cross-origin requests & JSON body parser
app.use(cors());
app.use(express.json());

/**
 * REST API ROUTER MOUNT
 * 
 * WHY:
 * Mounts all modular application features under `/api` path prefix:
 * - `/api/auth`  -> Login and Dev JWT Token generation routes.
 * - `/api/tasks` -> Authenticated Task CRUD operations & task status management.
 * - `/api/users` -> User management routes for listing, creating, and retrieving user profiles.
 */
app.use("/api", apiRouter);

/**
 * ROUTE: POST /mcp
 * 
 * WHY THIS ROUTE EXISTS:
 * Handles incoming Model Context Protocol (MCP) JSON-RPC 2.0 requests over HTTP using `@modelcontextprotocol/sdk`.
 * MCP allows external AI agents or clients (such as Claude Desktop or custom apps) to inspect and execute server tools, prompts, and resources.
 * 
 * HOW IT WORKS:
 * 1. Executes `authMiddleware` to verify the request's JWT Bearer token and derive `req.user`.
 * 2. Instantiates a dedicated per-request `McpServer` scoped with user context (`createMcpServer(req.user)`).
 * 3. Uses `StreamableHTTPServerTransport` in stateless mode to process the JSON-RPC request body and stream responses.
 * 4. Cleans up server & transport resources when the HTTP response closes.
 * 
 * SECURITY:
 * Requires valid JWT Bearer token via `authMiddleware`. User identity is passed directly to MCP tool execution contexts.
 */
app.post("/mcp", authMiddleware, async (req: AuthenticatedRequest, res) => {
  // Create an isolated MCP server instance with user authentication context
  const server = createMcpServer(req.user);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless operation per request
  });

  // Ensure transport & server instances close on socket completion
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
});

/**
 * HELPER: HTTP Method Not Allowed Handler for /mcp
 * 
 * WHY:
 * In stateless HTTP MCP transport, GET and DELETE requests are disallowed as there are no persisted HTTP sessions.
 * Explicitly returning 405 Method Not Allowed satisfies JSON-RPC transport specification requirements.
 */
const methodNotAllowed = (_req: express.Request, res: express.Response) =>
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Stateless transport only supports POST." },
    id: null,
  });

app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

/**
 * ROUTE: GET /health
 * 
 * WHY THIS ROUTE EXISTS:
 * Standard healthcheck endpoint used by container orchestrators (Docker, Kubernetes) or load balancers
 * to verify that the Express server process is running and accepting traffic.
 */
app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * ROUTE: POST /api/chat
 * 
 * WHY THIS ROUTE EXISTS:
 * Provides a global AI Chat endpoint accessible to public users or guest sessions (optional authentication).
 * Allows users to converse with the AI assistant, which can execute database tools on their behalf.
 * 
 * HOW IT WORKS:
 * 1. Runs `optionalAuthMiddleware` to extract user context if a Bearer token is provided, or assigns a guest context.
 * 2. Instantiates `createMcpServer(req.user)` to fetch all registered MCP tools.
 * 3. Calls `processChat(message, tools, context)` to route prompt through Gemini or Ollama fallback logic.
 * 4. Returns formatted content block response using `formatNativeAssistantResponse`.
 * 
 * INPUT BODY: `{ "message": "List all users" }`
 */
app.post(
  "/api/chat",
  optionalAuthMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const { message } = req.body;
    if (typeof message !== "string")
      return res.status(400).json({ error: "Invalid message format: expected string" });

    try {
      const userServer = createMcpServer(req.user);
      const tools = (userServer as any)._registeredTools;
      const aiResponse = await processChat(message, tools, {
        userId: req.user?.userId,
      });
      res.json(formatNativeAssistantResponse(aiResponse));
    } catch (err: any) {
      res.status(500).json({ error: `AI Processing Error: ${err.message}` });
    }
  },
);

/**
 * ROUTE: POST /api/chat/authenticated
 * 
 * WHY THIS ROUTE EXISTS:
 * Provides a strictly protected AI Chat endpoint requiring a valid JWT Bearer token.
 * Ensures user-scoped tools (e.g. task creation/deletion bound to specific user ID) are safely executed under verified identity.
 * 
 * HOW IT WORKS:
 * 1. Enforces `authMiddleware` (returns 401 Unauthorized if invalid or missing token).
 * 2. Instantiates user-bound MCP server and executes LLM process with enforced user context.
 * 3. Formats response payload with token usage statistics.
 * 
 * INPUT BODY: `{ "message": "Create task Finish Documentation" }`
 */
app.post(
  "/api/chat/authenticated",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const { message } = req.body;
    if (typeof message !== "string")
      return res.status(400).json({ error: "Invalid message format: expected string" });

    try {
      const userServer = createMcpServer(req.user);
      const tools = (userServer as any)._registeredTools;
      const aiResponse = await processChat(message, tools, {
        userId: req.user?.userId,
      });
      res.json(formatNativeAssistantResponse(aiResponse));
    } catch (err: any) {
      res.status(500).json({ error: `AI Processing Error: ${err.message}` });
    }
  },
);

/**
 * SWAGGER OPENAPI DOCUMENTATION MOUNT
 * 
 * WHY:
 * Automatically registers dynamic HTTP endpoints for testing MCP tools, prompts, and resources
 * and hosts interactive Swagger UI documentation at `/api-docs`.
 */
const swaggerServer = createMcpServer();
setupSwagger(app, swaggerServer);

/**
 * CENTRALIZED ERROR HANDLING MIDDLEWARE
 * 
 * WHY:
 * Catches unhandled exceptions thrown across async handlers or controllers, preventing server crashes
 * and returning standard JSON error messages to clients.
 */
app.use(errorHandlerMiddleware);

// Server Listener Initialization
const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () =>
  console.log(`Express MCP server successfully running on http://localhost:${PORT}`),
);
