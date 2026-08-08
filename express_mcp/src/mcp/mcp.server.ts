/**
 * @file mcp.server.ts
 * @description Factory function for initializing and configuring Model Context Protocol (MCP) server instances.
 * 
 * WHY THIS FILE EXISTS:
 * Encapsulates the registration of MCP Tools, Resources, and Prompts into a clean reusable factory function `createMcpServer(user)`.
 * Enables both per-request HTTP transport instantiation (`/mcp`, `/api/chat`) and persistent Stdio transport (`mcp:stdio`).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { AuthUser } from "../modules/auth/auth.dto.js";

/**
 * Creates and initializes a fresh McpServer instance bound with optional user authentication context.
 * 
 * WHY:
 * MCP tool handlers often require user authentication (e.g. creating a task bound to `user.userId`).
 * Passing `user` allows tool handlers to enforce authorization and user scoping.
 * 
 * @param user Optional authenticated user identity object.
 * @returns Configured McpServer instance with registered tools, resources, and prompts.
 */
export function createMcpServer(user?: AuthUser): McpServer {
  const server = new McpServer({
    name: "express-mcp-server",
    version: "1.0.0",
  });

  // Register all system tools (Math, Task CRUD, User Management)
  registerTools(server, user);
  
  // Register all system static/dynamic resources (e.g. app config)
  registerResources(server);
  
  // Register all system prompts (e.g. Code Review, Summarize User)
  registerPrompts(server);

  return server;
}
