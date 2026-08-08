/**
 * @file schema-converter.util.ts
 * @description Pure utility functions to convert plain JSON Schema (IMcpTool.inputSchema)
 * into the specific function-calling formats expected by different LLM providers.
 *
 * WHY THIS EXISTS:
 * Our IMcpTool uses plain JSON Schema objects (not Zod) for broad compatibility.
 * Ollama's API requires `{ type, function: { name, description, parameters } }`.
 * Keeping this conversion logic here keeps OllamaService clean and testable.
 */

import { IMcpTool } from '../interfaces/mcp-tool.interface';

/**
 * Converts a single IMcpTool into the Ollama function-calling tool format.
 *
 * @param name  Tool name (snake_case, used as the function identifier by Ollama).
 * @param tool  IMcpTool definition.
 * @returns     Ollama-compatible tool object ready to pass in `tools[]`.
 */
export function toOllamaTool(name: string, tool: IMcpTool) {
  // Strip any $schema key that may confuse some Ollama versions
  const schema: Record<string, unknown> = { ...tool.inputSchema };
  delete schema['$schema'];

  return {
    type: 'function' as const,
    function: {
      name,
      description: tool.description || `Execute tool ${name}`,
      parameters: schema,
    },
  };
}

/**
 * Converts the full MCP tool registry into an array of Ollama tool definitions.
 *
 * @param tools  Flat record of registered MCP tools.
 * @returns      Array of Ollama-formatted tool definitions.
 */
export function buildOllamaTools(tools: Record<string, IMcpTool>) {
  return Object.entries(tools).map(([name, tool]) => toOllamaTool(name, tool));
}
