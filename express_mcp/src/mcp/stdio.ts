/**
 * @file stdio.ts
 * @description Standalone Stdio Transport launcher for Model Context Protocol (MCP).
 * 
 * WHY THIS FILE EXISTS:
 * Enables integration with desktop AI clients (such as Claude Desktop, Cursor, or MCP CLI tools) that connect over standard input/output (stdio)
 * instead of HTTP endpoints.
 * 
 * HOW IT WORKS:
 * 1. Loads environment variables from project root `.env`.
 * 2. Creates a mock/admin user context (`STDIO_USER_ID`, `STDIO_USER_EMAIL`).
 * 3. Initializes `McpServer` and binds it to `StdioServerTransport`.
 * 4. Listens on `stdin` / `stdout` for JSON-RPC 2.0 frames.
 * 
 * RUN COMMAND:
 * `npm run mcp:stdio` or `npx tsx src/mcp/stdio.ts`
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp.server.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root directory regardless of execution cwd
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Bootstraps Stdio Server connection.
 */
async function runStdioServer() {
  // Define user identity attached to stdio sessions (admin context by default)
  const stdioUser = {
    userId: process.env.STDIO_USER_ID || "stdio-admin-1",
    email: process.env.STDIO_USER_EMAIL || "admin@localhost",
    role: "admin",
  };

  const server = createMcpServer(stdioUser);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("🚀 MCP Stdio server listening on stdio...");
}

runStdioServer().catch((err) => {
  console.error("Fatal MCP Stdio error:", err);
  process.exit(1);
});
