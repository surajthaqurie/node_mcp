/**
 * @file chat-formatter.util.ts
 * @description Pure utility functions for formatting AI chat responses and parsing
 * pagination state embedded in MCP tool text output.
 *
 * WHY THIS EXISTS:
 * Chat responses need to carry optional token usage metadata alongside the answer text.
 * Pagination state (e.g. "Page 2 of 5") needs to be parsed from tool output text so the
 * follow-up "next page" flow can resume correctly.
 * Extracting these into pure functions keeps the OllamaService focused on the LLM loop.
 */

/**
 * Represents a single text content block in a chat response.
 */
export interface ContentBlock {
  type: 'text';
  text: string;
}

/**
 * Standard chat response shape returned by the MCP chat endpoint
 * (mirrors the MCP SDK content array convention).
 */
export interface FormattedChatResponse {
  content: ContentBlock[];
}

/**
 * Pagination metadata parsed from a tool's text output.
 */
export interface PaginationState {
  /** Current page number (1-indexed) */
  page: number;

  /** Total number of pages available */
  totalPages: number;
}

/**
 * Wraps a plain text AI response into a structured content block array.
 *
 * If the response starts with `[Usage: X/Y tokens | remaining: Z]`, the usage
 * header is split into its own content block and the main answer follows.
 *
 * @param text  Raw response string from OllamaService.
 * @returns     Structured FormattedChatResponse.
 *
 * @example
 * formatChatResponse("[Usage: 500/20000 tokens | remaining: 19500]\n\nHello!")
 * // { content: [{ type: "text", text: "[Usage: ...]" }, { type: "text", text: "Hello!" }] }
 */
export function formatChatResponse(text: string): FormattedChatResponse {
  const usageMatch = text.match(/^(\[Usage:[^\]]+\])\s*\n\s*\n?([\s\S]*)$/);
  if (!usageMatch) {
    return { content: [{ type: 'text', text: text.trim() }] };
  }

  const usageBlock: ContentBlock = { type: 'text', text: usageMatch[1] };
  const answerText = usageMatch[2]?.trim() ?? '';

  return {
    content: [
      usageBlock,
      ...(answerText ? [{ type: 'text' as const, text: answerText }] : []),
    ],
  };
}

/**
 * Appends token usage metadata as a header line to a plain text response.
 * Used by OllamaService to annotate the final answer before returning to the controller.
 *
 * @param text      Raw LLM response text.
 * @param used      Tokens consumed this turn (estimated).
 * @param limit     Configured max token limit.
 * @param remaining Remaining token budget.
 * @returns         Text string prefixed with usage header.
 */
export function appendUsageHeader(
  text: string,
  used: number,
  limit: number,
  remaining: number,
): string {
  return `[Usage: ${used}/${limit} tokens | remaining: ${remaining}]\n\n${text}`;
}

/**
 * Parses "Page N of M" pagination metadata from MCP tool text output.
 *
 * WHY:
 * When paginated list tools return output like "Page 1 of 5", the chat service
 * needs to track the current page so "next page" follow-ups can increment it.
 *
 * @param text  Raw text output from a paginated MCP tool.
 * @returns     PaginationState if the pattern is found, or null.
 */
export function parsePaginationState(text: string): PaginationState | null {
  const match = text.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
  if (!match) return null;

  return {
    page: Number(match[1]),
    totalPages: Number(match[2]),
  };
}
