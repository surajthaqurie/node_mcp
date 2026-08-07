import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { setupSwagger } from "./swagger.js";
import cors from "cors";
import { processChat } from "./llm.js";
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from "./middleware/auth.middleware.js";
import { errorHandlerMiddleware } from "./middleware/error-handler.middleware.js";
import { apiRouter } from "./modules/index.js";
import { createMcpServer } from "./mcp/mcp.server.js";

// ---------------------------------------------------------------------------
// Express Application Setup & Functional NestJS-Style Architecture
// ---------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// Mount modular REST API routes (/api/auth, /api/tasks, /api/users)
app.use("/api", apiRouter);

// MCP JSON-RPC Transport with Auth Middleware
app.post("/mcp", authMiddleware, async (req: AuthenticatedRequest, res) => {
  // One fresh server + transport per request with authenticated user context
  const server = createMcpServer(req.user);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // undefined = stateless
  });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request failed", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Stateless mode has no server->client stream and no session to delete.
const methodNotAllowed = (_req: express.Request, res: express.Response) =>
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });

app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Global Public Chat (Works with or without JWT bearer token)
app.post("/api/chat", optionalAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  const { message } = req.body;
  if (typeof message !== "string")
    return res.json({ error: "Invalid message format" });

  try {
    const userServer = createMcpServer(req.user);
    const tools = (userServer as any)._registeredTools;
    const aiResponse = await processChat(message, tools);
    res.json({ content: [{ type: "text", text: aiResponse }] });
  } catch (err: any) {
    res.json({ error: `AI Error: ${err.message}` });
  }
});

// Authenticated User Chat (Requires valid Bearer JWT token)
app.post("/api/chat/authenticated", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { message } = req.body;
  if (typeof message !== "string")
    return res.json({ error: "Invalid message format" });

  try {
    const userServer = createMcpServer(req.user);
    const tools = (userServer as any)._registeredTools;
    const aiResponse = await processChat(message, tools);
    res.json({ content: [{ type: "text", text: aiResponse }] });
  } catch (err: any) {
    res.json({ error: `AI Error: ${err.message}` });
  }
});

const swaggerServer = createMcpServer();
setupSwagger(app, swaggerServer);

// Centralized Express Error Handling Middleware
app.use(errorHandlerMiddleware);

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () =>
  console.log(`Express MCP server running on http://localhost:${PORT}`),
);
