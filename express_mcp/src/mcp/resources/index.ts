/**
 * @file index.ts
 * @description Central registry for Model Context Protocol (MCP) data resources.
 * 
 * WHY THIS FILE EXISTS:
 * Mounts system resources (such as `config://app`) onto the McpServer instance.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppConfigResource } from "./app-config.resource.js";

/**
 * Registers all system data resources onto target McpServer instance.
 * 
 * @param server McpServer instance.
 */
export function registerResources(server: McpServer) {
  registerAppConfigResource(server);
}
