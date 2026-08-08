/**
 * @file math.tool.ts
 * @description Demonstration math tool registered on the Model Context Protocol (MCP) server.
 * 
 * WHY THIS FILE EXISTS:
 * Serves as a reference implementation showing how to register stateless tool functions with Zod validation schemas
 * and structured content return payloads.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Registers the 'add' mathematical tool on the MCP server instance.
 * 
 * INPUT SCHEMA: `{ a: number, b: number }`
 * OUTPUT: Standard text content block containing computed sum string.
 * 
 * @param server Target McpServer instance.
 */
export function registerMathTool(server: McpServer) {
  server.registerTool(
    "add",
    {
      title: "Add numbers",
      description: "Perform addition of two numbers",
      inputSchema: {
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      },
    },
    async ({ a, b }) => {
      const sum = a + b;
      return {
        content: [{ type: "text", text: `The sum of ${a} and ${b} is ${sum}.` }],
      };
    }
  );
}
