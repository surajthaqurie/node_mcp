import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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
