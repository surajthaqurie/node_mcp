/**
 * @file code-review.prompt.ts
 * @description MCP Prompt definition for generating structured code review requests.
 * 
 * WHY THIS FILE EXISTS:
 * Prompts are reusable templates in MCP that AI clients can inspect and instantiate with arguments
 * to guide LLM code evaluation workflows.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Registers 'code_review' prompt template on MCP server instance.
 * 
 * ARGS: `{ code: string, language?: string }`
 * RETURNS: Array containing user role message formatted for AI analysis.
 */
export function registerCodeReviewPrompt(server: McpServer) {
  server.registerPrompt(
    "code_review",
    {
      title: "Code Review",
      description: "Review a code snippet for best practices, security, and performance",
      argsSchema: {
        code: z.string().describe("Code to review"),
        language: z.string().optional().describe("Programming language"),
      },
    },
    (args: any) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please perform a thorough code review for the following ${args.language || "code"} snippet:\n\n\`\`\`${args.language || ""}\n${args.code}\n\`\`\``,
          },
        },
      ],
    })
  );
}
