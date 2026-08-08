/**
 * @file app-config.resource.ts
 * @description MCP Resource definition exposing application runtime configuration over URI `config://app`.
 * 
 * WHY THIS FILE EXISTS:
 * MCP Resources act as readable data endpoints (similar to HTTP GET endpoints or file reads)
 * enabling LLM clients to fetch static context such as environment configuration or system status.
 */

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Registers the 'config://app' resource on MCP server instance.
 * 
 * @param server Target McpServer instance.
 */
export function registerAppConfigResource(server: McpServer) {
  server.registerResource(
    "config",
    new ResourceTemplate("config://app", { list: undefined }),
    {
      title: "App Config",
      description: "Application configuration settings",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify({
            appName: "Express MCP Service",
            version: "1.0.0",
            environment: process.env.NODE_ENV || "development",
          }),
        },
      ],
    }),
  );
}
