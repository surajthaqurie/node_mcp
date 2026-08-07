import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp.server.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root directory regardless of execution cwd
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function runStdioServer() {
  // Pass local authenticated user context for stdio clients (Claude Desktop / Cursor)
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
