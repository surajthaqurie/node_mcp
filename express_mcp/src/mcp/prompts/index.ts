/**
 * @file index.ts
 * @description Central registry for Model Context Protocol (MCP) prompt templates.
 * 
 * WHY THIS FILE EXISTS:
 * Aggregates all reusable system prompt definitions (`code_review`, `summarize_user`) onto the McpServer instance.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCodeReviewPrompt } from "./code-review.prompt.js";
import { registerSummarizeUserPrompt } from "./summarize-user.prompt.js";

/**
 * Registers all system prompts onto target McpServer instance.
 * 
 * @param server McpServer instance.
 */
export function registerPrompts(server: McpServer) {
  registerCodeReviewPrompt(server);
  registerSummarizeUserPrompt(server);
}
