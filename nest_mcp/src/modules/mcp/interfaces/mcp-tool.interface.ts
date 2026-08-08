/**
 * @file mcp-tool.interface.ts
 * @description Shared interface contract for all MCP tool definitions in the NestJS app.
 * Ensures every tool exposes: a unique name, description, JSON input schema, and an async handler.
 */

import { User } from '../../users/entities/user.entity';

export interface IMcpTool {
  /** Unique snake_case tool name (used as the function name by Ollama) */
  name: string;

  /** Human-readable description telling the LLM what this tool does */
  description: string;

  /**
   * JSON Schema object describing accepted input parameters.
   * Follows the MCP SDK's ZodRawShape / JSON Schema format.
   */
  inputSchema: Record<string, unknown>;

  /**
   * Async tool handler function.
   * Receives parsed args from the LLM and optional authenticated user, returning MCP-compatible content array.
   */
  handler: (
    args: Record<string, unknown>,
    user?: User | null,
  ) => Promise<{
    content: Array<{ type: string; text: string }>;
  }>;
}
