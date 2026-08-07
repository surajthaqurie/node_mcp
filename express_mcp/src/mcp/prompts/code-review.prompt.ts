import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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
