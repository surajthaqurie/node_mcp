/**
 * @file llm.ts
 * @description Core LLM processing engine powering AI chat and automated MCP tool invocation.
 * 
 * WHY THIS FILE EXISTS:
 * Serves as the central bridge between incoming user chat requests, AI language models (Google Gemini API & local Ollama),
 * and the Model Context Protocol (MCP) server environment.
 * 
 * CORE RESPONSIBILITIES:
 * 1. Provider Routing & Resilience: Attempts processing with Google Gemini API first; automatically falls back to local Ollama if Gemini key is missing or API fails.
 * 2. MCP Function Calling Loop: Dynamically feeds available MCP tools to LLMs, parses tool call requests, executes tool handlers, and feeds results back to LLM until final answer is obtained.
 * 3. Interactive Follow-up Pagination: Maintains `followUpState` per user session for paginated database listing prompts (e.g. "next page", "continue").
 * 4. Token & Usage Management: Leverages standalone `utils` to enforce token quotas per session key.
 */

import { Ollama } from "ollama";
import { GoogleGenAI } from "@google/genai";
import {
  shouldUseGemini,
  createOllamaTool,
  createGeminiTool,
  parsePaginationState,
  checkUsageLimit,
  getUsageSummary,
  buildSystemInstruction,
} from "./utils/index.js";

/**
 * Initializes and configures the Ollama client connection.
 * Reads optional `OLLAMA_HOST` and `OLLAMA_API_KEY` environment variables.
 * 
 * @returns Configured Ollama SDK instance.
 */
const getOllamaClient = () => {
  const config: any = {};
  if (process.env.OLLAMA_HOST) {
    config.host = process.env.OLLAMA_HOST;
  }
  if (process.env.OLLAMA_API_KEY) {
    config.headers = {
      Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
    };
  }
  return new Ollama(config);
};

const ollamaClient = getOllamaClient();

/**
 * In-memory map storing pagination session context (last used tool, current page index, search query, total pages)
 * indexed by user session key (`context.userId` or `"default"`).
 */
const followUpState = new Map<
  string,
  {
    toolName: string;
    page: number;
    query?: string;
    searchBy?: string;
    totalPages: number;
  }
>();

/**
 * Primary entry point for processing incoming chat prompts and executing MCP tool loops.
 * 
 * WHY THIS FUNCTION EXISTS:
 * Handles incoming chat messages, manages session token limits, detects pagination follow-up prompts ("next", "continue"),
 * routes prompts to Gemini or Ollama, and returns final formatted output.
 * 
 * @param message Raw text message sent by user.
 * @param tools Dictionary of active MCP tool definitions registered on the MCP server.
 * @param context Optional context containing authenticated user identity (`userId`).
 * @returns Promise resolving to formatted response string with optional usage header.
 */
export async function processChat(
  message: string,
  tools: Record<string, any>,
  context?: { userId?: string },
): Promise<string> {
  const sessionKey = context?.userId || "default";
  const normalizedMessage = message.trim().toLowerCase();

  // Enforce session token limit quota using standalone utility
  const usageLimitError = checkUsageLimit(sessionKey, message);
  if (usageLimitError) {
    return `${usageLimitError}\n\nNo further chat requests will be processed until the usage window resets.`;
  }

  const followUpStateEntry = followUpState.get(sessionKey);

  // Check if message is a pagination command ("next", "next page", "continue", "show more")
  const shouldUseFollowUpPage =
    (normalizedMessage === "next" ||
      normalizedMessage === "next page" ||
      normalizedMessage === "continue" ||
      normalizedMessage === "show more") &&
    followUpStateEntry?.toolName === "get_all_users";

  // Quick execution path for direct pagination prompts on user listing tool
  if (shouldUseFollowUpPage && tools["get_all_users"]) {
    const nextPage = Math.min(
      followUpStateEntry.page + 1,
      followUpStateEntry.totalPages,
    );
    const followUpArgs = {
      page: nextPage,
      query: followUpStateEntry.query,
      searchBy: followUpStateEntry.searchBy || "all",
    };

    try {
      const mcpResult = await tools["get_all_users"].handler(followUpArgs, {});
      const textOutput = mcpResult.content.map((c: any) => c.text).join("\n");
      const parsedState = parsePaginationState(textOutput);
      if (parsedState) {
        followUpState.set(sessionKey, {
          toolName: "get_all_users",
          page: parsedState.page,
          query: followUpStateEntry.query,
          searchBy: followUpStateEntry.searchBy || "all",
          totalPages: parsedState.totalPages,
        });
      }
      return textOutput;
    } catch (err: any) {
      return `Error executing get_all_users: ${err.message}`;
    }
  }

  const followUpArgs = shouldUseFollowUpPage
    ? {
        page: Math.min(
          followUpStateEntry.page + 1,
          followUpStateEntry.totalPages,
        ),
        query: followUpStateEntry.query,
        searchBy: followUpStateEntry.searchBy || "all",
      }
    : undefined;

  // Primary routing: Use Google Gemini API if key is present; fallback to local Ollama on failure or missing key.
  if (shouldUseGemini()) {
    console.log("Routing chat request via Google Gemini API");
    try {
      const response = await processWithGemini(
        message,
        tools,
        followUpArgs,
        sessionKey,
      );
      const summary = getUsageSummary(sessionKey, message, response);
      return `[Usage: ${summary.usage.totalTokens}/${summary.limit} tokens | remaining: ${summary.remaining}]\n\n${response}`;
    } catch (err: any) {
      console.warn("Gemini execution failed, falling back to local Ollama:", err.message);
      try {
        return await processWithOllama(
          message,
          tools,
          followUpArgs,
          sessionKey,
        );
      } catch (ollamaErr: any) {
        throw new Error(
          `Gemini Error: ${err.message} | Ollama Fallback Error: ${ollamaErr.message}`,
        );
      }
    }
  } else {
    console.log("Routing chat request via Ollama API");
    const response = await processWithOllama(
      message,
      tools,
      followUpArgs,
      sessionKey,
    );
    const summary = getUsageSummary(sessionKey, message, response);
    return `[Usage: ${summary.usage.totalTokens}/${summary.limit} tokens | remaining: ${summary.remaining}]\n\n${response}`;
  }
}

/**
 * Processes chat prompt using Google Gemini API (`gemini-2.5-flash`) with dynamic MCP tool function declarations.
 * 
 * HOW IT WORKS:
 * 1. Converts MCP tool input schemas into Gemini tool declarations.
 * 2. Initiates Gemini chat session with structured system instructions.
 * 3. Listens for `functionCalls` emitted by model.
 * 4. Executes requested tool handlers on the server and feeds `{ functionResponse }` back to Gemini in a loop.
 * 5. Returns final text output when no further function calls are returned.
 */
async function processWithGemini(
  message: string,
  tools: Record<string, any>,
  followUpArgs?: { page?: number; query?: string; searchBy?: string },
  sessionKey?: string,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const systemInstruction = buildSystemInstruction(tools);

  const functionDeclarations = Object.entries(tools).map(([name, tool]) =>
    createGeminiTool(name, tool),
  );

  const geminiTools = [{ functionDeclarations }];

  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: systemInstruction,
      tools: geminiTools,
    },
  });

  let response = await chat.sendMessage({
    message: followUpArgs
      ? `${message}\n\n[follow-up tool args: ${JSON.stringify(followUpArgs)}]`
      : message,
  });

  // Iterative MCP function calling loop
  while (response.functionCalls && response.functionCalls.length > 0) {
    const call = response.functionCalls[0];
    const toolName = call.name as string;
    const args = call.args || {};

    let toolResult;
    if (tools[toolName]) {
      try {
        const mcpResult = await tools[toolName].handler(args, {});
        const textOutput = mcpResult.content.map((c: any) => c.text).join("\n");
        if (toolName === "get_all_users" && sessionKey) {
          const parsedState = parsePaginationState(textOutput);
          if (parsedState) {
            followUpState.set(sessionKey, {
              toolName,
              page: parsedState.page,
              query: (args as any).query,
              searchBy: (args as any).searchBy || "all",
              totalPages: parsedState.totalPages,
            });
          }
        }
        toolResult = { result: textOutput };
      } catch (err: any) {
        toolResult = { error: err.message };
      }
    } else {
      toolResult = { error: "Unknown tool" };
    }

    response = await chat.sendMessage({
      message: [
        {
          functionResponse: {
            name: toolName,
            response: toolResult as any,
          },
        },
      ] as any,
    });
  }

  return response.text || "";
}

/**
 * Processes chat prompt using local Ollama model (e.g. `qwen2.5:0.5b`) with MCP tool function call support.
 * 
 * HOW IT WORKS:
 * 1. Converts MCP tool input schemas into Ollama function definitions using `createOllamaTool`.
 * 2. Sends conversation array (`system` prompt + `user` prompt) to Ollama client.
 * 3. Handles `tool_calls` responses by executing corresponding MCP tool handlers and appending `role: "tool"` messages.
 * 4. Includes fallback rule matching for lightweight local models that fail to emit explicit JSON tool calls.
 */
async function processWithOllama(
  message: string,
  tools: Record<string, any>,
  followUpArgs?: { page?: number; query?: string; searchBy?: string },
  sessionKey?: string,
): Promise<string> {
  const ollamaTools = Object.entries(tools).map(([name, tool]) =>
    createOllamaTool(name, tool),
  );
  const systemInstruction = buildSystemInstruction(tools);

  const model = process.env.OLLAMA_MODEL || "qwen2.5:0.5b";
  const messages = [
    { role: "system", content: systemInstruction },
    { role: "user", content: message },
  ];

  let response = await ollamaClient.chat({
    model: model,
    messages,
    tools: ollamaTools as any,
  });

  // Handle explicit tool calls returned by Ollama
  while (
    response.message.tool_calls &&
    response.message.tool_calls.length > 0
  ) {
    messages.push(response.message as any);

    for (const call of response.message.tool_calls) {
      const toolName = call.function.name;
      const args = call.function.arguments || {};

      let toolResult;
      if (tools[toolName]) {
        try {
          const mcpResult = await tools[toolName].handler(args, {});
          const textOutput = mcpResult.content
            .map((c: any) => c.text)
            .join("\n");
          if (toolName === "get_all_users" && sessionKey) {
            const parsedState = parsePaginationState(textOutput);
            if (parsedState) {
              followUpState.set(sessionKey, {
                toolName,
                page: parsedState.page,
                query: (args as any).query,
                searchBy: (args as any).searchBy || "all",
                totalPages: parsedState.totalPages,
              });
            }
          }
          toolResult = textOutput;
        } catch (err: any) {
          toolResult = err.message;
        }
      } else {
        toolResult = "Unknown tool";
      }

      messages.push({
        role: "tool",
        content: toolResult,
      });
    }

    response = await ollamaClient.chat({
      model: model,
      messages,
      tools: ollamaTools as any,
    });
  }

  // Smart intent fallback for small local models if tool call wasn't automatically generated for listing requests
  if (
    !response.message.content ||
    response.message.content.toLowerCase().includes("email") ||
    response.message.content.toLowerCase().includes("provide")
  ) {
    const lower = message.toLowerCase();
    let fallbackTool: string | null = null;

    if (
      (lower.includes("list") ||
        lower.includes("show") ||
        lower.includes("get") ||
        lower.includes("fetch") ||
        lower.includes("users")) &&
      (lower.includes("user") || lower.includes("users"))
    ) {
      fallbackTool = "get_all_users";
    } else if (
      (lower.includes("task") || lower.includes("tasks")) &&
      (lower.includes("count") ||
        lower.includes("counts") ||
        lower.includes("stats") ||
        lower.includes("summary") ||
        lower.includes("dashboard") ||
        lower.includes("deleted"))
    ) {
      fallbackTool = lower.includes("deleted")
        ? "get_deleted_task_counts_by_user"
        : "get_task_counts_by_user";
    } else if (
      (lower.includes("list") ||
        lower.includes("show") ||
        lower.includes("get") ||
        lower.includes("fetch") ||
        lower.includes("tasks")) &&
      (lower.includes("task") || lower.includes("tasks"))
    ) {
      fallbackTool = "list_tasks";
    }

    if (fallbackTool && tools[fallbackTool]) {
      try {
        const mcpResult = await tools[fallbackTool].handler(
          fallbackTool === "get_all_users" && followUpArgs ? followUpArgs : {},
          {},
        );
        return mcpResult.content.map((c: any) => c.text).join("\n");
      } catch (err: any) {
        return `Error executing ${fallbackTool}: ${err.message}`;
      }
    }
  }

  return response.message.content || "";
}
