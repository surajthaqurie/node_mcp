import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { AuthUser } from "../modules/auth/auth.dto.js";

export function createMcpServer(user?: AuthUser): McpServer {
  const server = new McpServer({
    name: "express-mcp-server",
    version: "1.0.0",
  });

  registerTools(server, user);
  registerResources(server);
  registerPrompts(server);

  return server;
}
