import { Ollama } from "ollama";
import { GoogleGenAI } from "@google/genai";
import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";

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

// Helper to determine if we should use Gemini
function shouldUseGemini() {
  const key = process.env.GEMINI_API_KEY;
  return (
    key &&
    key.trim() !== "" &&
    key !== "YOUR_GEMINI_API_KEY_HERE" &&
    !key.startsWith("AQ.")
  );
}

// Reusable function to convert a tool for Ollama
function createOllamaTool(name: string, tool: any) {
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

// Reusable function to convert a tool for Gemini
function createGeminiTool(name: string, tool: any) {
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

// Main exported function to process chat
export async function processChat(
  message: string,
  tools: Record<string, any>,
): Promise<string> {
  if (shouldUseGemini()) {
    console.log("Routing chat via Gemini");
    try {
      return await processWithGemini(message, tools);
    } catch (err: any) {
      console.warn("Gemini failed, falling back to Ollama:", err.message);
      try {
        return await processWithOllama(message, tools);
      } catch (ollamaErr: any) {
        throw new Error(
          `Gemini Error: ${err.message} | Ollama Fallback Error: ${ollamaErr.message}`,
        );
      }
    }
  } else {
    console.log("Routing chat via Ollama");
    return await processWithOllama(message, tools);
  }
}

function buildSystemInstruction(tools: Record<string, any>): string {
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
2. IF the user asks to list tasks or view tasks, YOU MUST IMMEDIATELY CALL THE 'list_tasks' TOOL.
3. ONLY ask clarifying questions if creating/updating a specific record and missing required parameters.
4. Always invoke tool calls directly instead of explaining what you need.`;
}

async function processWithGemini(
  message: string,
  tools: Record<string, any>,
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

  let response = await chat.sendMessage({ message });

  // Handle tool calls if any
  while (response.functionCalls && response.functionCalls.length > 0) {
    const call = response.functionCalls[0];
    const toolName = call.name as string;
    const args = call.args || {};

    let toolResult;
    if (tools[toolName]) {
      try {
        const mcpResult = await tools[toolName].handler(args, {});
        const textOutput = mcpResult.content.map((c: any) => c.text).join("\n");
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

async function processWithOllama(
  message: string,
  tools: Record<string, any>,
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

  // Handle tool calls if any
  while (
    response.message.tool_calls &&
    response.message.tool_calls.length > 0
  ) {
    messages.push(response.message as any); // Append assistant's tool call message

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

  // Fallback for lightweight local models (e.g. qwen2.5:0.5b) if no tool call was emitted for clear list intents
  if (!response.message.content || response.message.content.toLowerCase().includes("email") || response.message.content.toLowerCase().includes("provide")) {
    const lower = message.toLowerCase();
    let fallbackTool: string | null = null;

    if (
      (lower.includes("list") || lower.includes("show") || lower.includes("get") || lower.includes("fetch") || lower.includes("users")) &&
      (lower.includes("user") || lower.includes("users"))
    ) {
      fallbackTool = "get_all_users";
    } else if (
      (lower.includes("list") || lower.includes("show") || lower.includes("get") || lower.includes("fetch") || lower.includes("tasks")) &&
      (lower.includes("task") || lower.includes("tasks"))
    ) {
      fallbackTool = "list_tasks";
    }

    if (fallbackTool && tools[fallbackTool]) {
      try {
        const mcpResult = await tools[fallbackTool].handler({}, {});
        return mcpResult.content.map((c: any) => c.text).join("\n");
      } catch (err: any) {
        return `Error executing ${fallbackTool}: ${err.message}`;
      }
    }
  }

  return response.message.content || "";
}
