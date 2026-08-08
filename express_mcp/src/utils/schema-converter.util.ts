/**
 * @file schema-converter.util.ts
 * @description Standalone utilities to adapt MCP Zod input schemas to LLM provider function declaration formats (Gemini & Ollama).
 * 
 * WHY THIS UTILITY EXISTS:
 * MCP tools define input validation schemas using Zod. Different LLM providers (Google Gemini API, Ollama API) expect specific
 * Function Calling JSON schema formats. These standalone utility functions perform JSON schema conversion and cleaning,
 * decoupling LLM schema adaptation from core application code.
 */

import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";

/**
 * Checks whether valid Google Gemini API Key is configured in environment variables.
 * 
 * WHY:
 * Determines whether processChat should route prompts via Google Gemini or fallback to local Ollama.
 * 
 * @returns Boolean true if valid Gemini API key exists, false otherwise.
 */
export function shouldUseGemini(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return (
    Boolean(key) &&
    key!.trim() !== "" &&
    key !== "YOUR_GEMINI_API_KEY_HERE" &&
    !key!.startsWith("AQ.")
  );
}

/**
 * Transforms MCP Tool definition into function calling schema format compatible with Ollama API.
 * 
 * WHY:
 * Ollama requires tools formatted as `{ type: "function", function: { name, description, parameters } }`.
 * 
 * @param name Unique name of MCP tool.
 * @param tool MCP tool definition containing description and Zod inputSchema.
 * @returns Formatted tool object for Ollama API payload.
 */
export function createOllamaTool(name: string, tool: any) {
  let jsonSchema: any = { type: "object", properties: {} };
  if (tool.inputSchema) {
    jsonSchema = toJsonSchemaCompat(tool.inputSchema);
    delete jsonSchema.$schema;
  }
  return {
    type: "function",
    function: {
      name,
      description: tool.description || `Execute tool ${name}`,
      parameters: jsonSchema,
    },
  };
}

/**
 * Transforms MCP Tool definition into function declaration format compatible with Google Gemini SDK.
 * 
 * WHY:
 * Gemini SDK expects tool declarations as `{ name, description, parameters }` inside functionDeclarations array.
 * 
 * @param name Unique name of MCP tool.
 * @param tool MCP tool definition containing description and Zod inputSchema.
 * @returns Formatted tool declaration object for Gemini SDK.
 */
export function createGeminiTool(name: string, tool: any) {
  let jsonSchema: any = { type: "object", properties: {} };
  if (tool.inputSchema) {
    jsonSchema = toJsonSchemaCompat(tool.inputSchema);
    delete jsonSchema.$schema;
  }
  return {
    name,
    description: tool.description || `Execute tool ${name}`,
    parameters: jsonSchema,
  };
}
