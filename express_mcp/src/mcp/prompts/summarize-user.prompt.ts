/**
 * @file summarize-user.prompt.ts
 * @description MCP Prompt definition for summarizing user profiles.
 * 
 * WHY THIS FILE EXISTS:
 * Provides a standardized prompt template for generating concise executive summaries of user identities.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Registers 'summarize_user' prompt template on MCP server instance.
 * 
 * ARGS: `{ name: string, email: string, role?: string }`
 */
export function registerSummarizeUserPrompt(server: McpServer) {
  server.registerPrompt(
    "summarize_user",
    {
      title: "Summarize User Profile",
      description: "Generate a summary profile for a given user",
      argsSchema: {
        name: z.string().describe("User's name"),
        email: z.string().describe("User's email"),
        role: z.string().optional().describe("User's role"),
      },
    },
    (args: any) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please summarize the profile for user ${args.name} (${args.email}) with role '${args.role || "user"}'.`,
          },
        },
      ],
    })
  );
}
