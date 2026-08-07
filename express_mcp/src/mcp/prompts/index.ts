import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCodeReviewPrompt } from "./code-review.prompt.js";
import { registerSummarizeUserPrompt } from "./summarize-user.prompt.js";

export function registerPrompts(server: McpServer) {
  registerCodeReviewPrompt(server);
  registerSummarizeUserPrompt(server);
}
