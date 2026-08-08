/**
 * @file system-prompt-builder.util.ts
 * @description Standalone helper utility for constructing dynamic system prompts injected into LLM sessions.
 * 
 * WHY THIS UTILITY EXISTS:
 * MCP servers dynamically register tools, prompts, and resources. System instructions given to LLMs must accurately list all
 * currently registered tools along with strict rules guiding tool selection and pagination behavior. Extracting this helper function
 * ensures system instructions can be reused, tested, and modified independently of LLM client logic.
 */

/**
 * Builds standardized system instructions detailing available MCP tools and execution guidelines for LLMs.
 * 
 * WHY:
 * Guides the LLM model (Gemini or Ollama) to automatically invoke appropriate MCP tool functions (e.g. `get_all_users`, `list_tasks`)
 * instead of generating plain text conversational placeholders when users ask to view or mutate system data.
 * 
 * @param tools Record map of registered MCP tool definitions.
 * @returns Comprehensive system prompt string injected into LLM session context.
 */
export function buildSystemInstruction(tools: Record<string, any>): string {
  const toolDescriptions = Object.entries(tools)
    .map(
      ([name, tool]) =>
        `- ${name}: ${tool.description || "No description provided"}`,
    )
    .join("\n");

  return `You are an AI Assistant with direct access to Model Context Protocol (MCP) database tools.

AVAILABLE TOOLS:
${toolDescriptions}

CRITICAL RULES:
1. IF the user asks to list users, view users, show users, or mentions user listing (e.g., "list users", "give me the list of users", "I need to list the users", "show users"), YOU MUST IMMEDIATELY CALL THE 'get_all_users' TOOL. DO NOT ask for user IDs or names for a list request.
2. If the user says "next", "next page", "continue", or "show more" after a user list, call the 'get_all_users' tool again with the next page number and preserve any search query.
3. IF the user asks to list tasks or view tasks, YOU MUST IMMEDIATELY CALL THE 'list_tasks' TOOL.
4. If the user asks for task statistics, counts, summaries, deleted-task counts, or admin dashboard info, call the relevant reporting tools such as 'get_task_counts_by_user' or 'get_deleted_task_counts_by_user'.
5. ONLY ask clarifying questions if creating/updating a specific record and missing required parameters.
6. Always invoke tool calls directly instead of explaining what you need.`;
}
