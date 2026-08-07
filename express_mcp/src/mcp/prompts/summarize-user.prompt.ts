import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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
