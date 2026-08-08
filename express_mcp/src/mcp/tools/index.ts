/**
 * @file index.ts
 * @description Central registration registry for all MCP Tools in the server.
 * 
 * WHY THIS FILE EXISTS:
 * Aggregates and mounts standalone tool registration modules (Math tools, User database tools, Task management tools)
 * onto the McpServer instance.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMathTool } from "./math.tool.js";
import { registerUserTools } from "../../modules/users/users.tools.js";
import { registerTaskTools } from "../../modules/tasks/tasks.tools.js";
import { AuthUser } from "../../modules/auth/auth.dto.js";

/**
 * Registers all available tool groups onto an MCP server instance.
 * 
 * @param server McpServer instance.
 * @param user Optional authenticated user identity context.
 */
export function registerTools(server: McpServer, user?: AuthUser) {
  registerMathTool(server);
  registerUserTools(server, user);
  registerTaskTools(server, user);
}
