/**
 * @file system-prompt-builder.util.ts
 * @description Pure utility for constructing the system prompt injected into every Ollama chat session.
 *
 * WHY THIS EXISTS:
 * The system prompt must dynamically list all currently registered MCP tools so the LLM
 * knows what actions it can take. Extracting it here keeps OllamaService focused on the
 * chat loop and makes the prompt easy to tune independently.
 */

import { IMcpTool } from '../interfaces/mcp-tool.interface';

/**
 * Builds the system instruction string that is prepended to every Ollama conversation.
 *
 * The prompt:
 *  1. Declares the AI's role (task + user management assistant).
 *  2. Lists every registered tool by name and description.
 *  3. Provides strict rules to force tool usage over hallucinated answers.
 *
 * @param tools  Flat record of registered MCP tools.
 * @returns      Complete system prompt string.
 */
export function buildSystemPrompt(tools: Record<string, IMcpTool>): string {
  const toolList = Object.entries(tools)
    .map(
      ([name, tool]) =>
        `  - ${name}: ${tool.description || 'No description provided'}`,
    )
    .join('\n');

  return `You are a helpful AI assistant with direct access to a task management and user management system via MCP tools.

AVAILABLE TOOLS:
${toolList}

CRITICAL RULES:
1. ALWAYS call the appropriate tool when the user asks about tasks or users — never make up data.
2. For listing requests ("show all tasks", "list users", "get tasks"), immediately call the corresponding list tool.
3. For statistics or counts ("how many users", "task stats"), call the stats tool.
4. Present tool results clearly and concisely — do not repeat raw IDs unless asked.
5. If a required argument (e.g. task ID) is missing, ask the user for it before calling the tool.
6. If a tool returns an error, explain it clearly rather than retrying silently.
7. Never ask for clarification on list/stats requests — just call the tool directly.`;
}
