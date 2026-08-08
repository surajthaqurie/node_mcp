/**
 * @file ollama.service.ts
 * @description Core Ollama LLM integration service that powers the AI chat feature.
 *
 * WHY THIS EXISTS:
 * Wraps the Ollama SDK to handle:
 *  1. Multi-turn MCP function-calling loop — sends tool definitions to Ollama,
 *     processes tool_calls responses, executes the matching MCP handlers, and
 *     feeds results back to Ollama until a final text answer is produced.
 *  2. Automatic fallback rule matching — small local models sometimes fail to
 *     emit structured tool_calls. A keyword intent fallback catches obvious
 *     list/stats/get requests and executes the appropriate tool directly.
 *  3. Configurable model — reads OLLAMA_MODEL from env (default: qwen2.5:1.5b).
 *  4. Configurable host — reads OLLAMA_HOST from env (default: http://localhost:11434).
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Ollama, ChatResponse, Message } from 'ollama';
import { McpServerService } from './mcp-server.service';
import { IMcpTool } from './interfaces/mcp-tool.interface';
import {
  buildOllamaTools,
  buildSystemPrompt,
  checkTokenLimit,
  trackUsage,
  appendUsageHeader,
} from './utils/index';

@Injectable()
export class OllamaService implements OnModuleInit {
  private readonly logger = new Logger(OllamaService.name);
  private ollamaClient: Ollama;
  private model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly mcpServerService: McpServerService,
  ) {}

  onModuleInit() {
    const host =
      this.configService.get<string>('OLLAMA_HOST') || 'http://localhost:11434';
    this.model =
      this.configService.get<string>('OLLAMA_MODEL') || 'qwen2.5:1.5b';

    const config: ConstructorParameters<typeof Ollama>[0] = { host };

    const apiKey = this.configService.get<string>('OLLAMA_API_KEY');
    if (apiKey) {
      config.headers = { Authorization: `Bearer ${apiKey}` };
    }

    this.ollamaClient = new Ollama(config);
    this.logger.log(
      `✅ Ollama client initialized — host: ${host}, model: ${this.model}`,
    );
  }

  /**
   * Processes a user message through the Ollama MCP tool-calling loop.
   *
   * Flow:
   * 1. Check session token usage limit using token-estimator utility.
   * 2. Build Ollama-compatible tool schemas and system prompt via schema-converter & system-prompt-builder.
   * 3. Send system prompt + user message to Ollama.
   * 4. If Ollama responds with tool_calls, execute each handler and feed back tool results.
   * 5. Repeat until Ollama produces a final text response (no more tool calls).
   * 6. Apply keyword-based fallback if Ollama skips tool calls on obvious requests.
   * 7. Track usage and attach token summary header to response.
   *
   * @param message    The user's input message.
  /**
   * Processes a user message through the Ollama MCP tool-calling loop.
   *
   * @param message    The user's input message.
   * @param sessionKey Unique key for tracking session limits (e.g. userId or 'default').
   * @param options    Options including isAuthenticated flag.
   * @returns Final response text from Ollama annotated with token usage stats.
   */
  async chat(
    message: string,
    sessionKey = 'default',
    options: { isAuthenticated?: boolean } = {},
  ): Promise<string> {
    // ── Token limit check ───────────────────────────────────────────────────
    const limitError = checkTokenLimit(sessionKey, message);
    if (limitError) {
      throw new BadRequestException(limitError);
    }

    const tools = this.mcpServerService.getTools();
    const ollamaTools = buildOllamaTools(tools);
    const systemPrompt = buildSystemPrompt(tools);

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];

    this.logger.debug(
      `Starting Ollama chat with model "${this.model}", session "${sessionKey}", authenticated: ${!!options.isAuthenticated}, message: "${message}"`,
    );

    let response: ChatResponse;
    try {
      response = await this.ollamaClient.chat({
        model: this.model,
        messages,
        tools: ollamaTools,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string }).code;

      this.logger.error(`Ollama connection failed: ${msg}`);
      // ECONNREFUSED / fetch failure → Ollama is not running
      if (
        msg.includes('ECONNREFUSED') ||
        msg.includes('fetch failed') ||
        code === 'ECONNREFUSED'
      ) {
        throw new ServiceUnavailableException(
          `Ollama is not reachable at ${this.configService.get('OLLAMA_HOST') || 'http://localhost:11434'}. ` +
            `Make sure Ollama is running and the model "${this.model}" is pulled.`,
        );
      }
      // Model not found
      if (msg.includes('model') && msg.includes('not found')) {
        throw new ServiceUnavailableException(
          `Ollama model "${this.model}" is not available. Run: ollama pull ${this.model}`,
        );
      }
      throw new InternalServerErrorException(`Ollama request failed: ${msg}`);
    }

    // ── Check authentication before executing database tool calls ──────────
    if (
      response.message.tool_calls &&
      response.message.tool_calls.length > 0 &&
      !options.isAuthenticated
    ) {
      const toolNames = response.message.tool_calls
        .map((c) => c.function.name)
        .join(', ');
      this.logger.warn(
        `Unauthenticated user attempted to invoke database tool(s): ${toolNames}`,
      );
      const authMessage =
        '🔒 Authentication Required: Accessing or querying database records (users, tasks, permissions) requires an active session. Please sign in to your account to execute database tools.';
      const summary = trackUsage(sessionKey, message, authMessage);
      return appendUsageHeader(
        authMessage,
        summary.usage.totalTokens,
        summary.limit,
        summary.remaining,
      );
    }

    // ── MCP function-calling loop ────────────────────────────────────────────
    let iterations = 0;
    const MAX_ITERATIONS = 6;

    while (
      response.message.tool_calls &&
      response.message.tool_calls.length > 0 &&
      iterations < MAX_ITERATIONS
    ) {
      iterations++;
      this.logger.debug(`Tool-calling loop iteration ${iterations}`);

      messages.push(response.message);

      for (const call of response.message.tool_calls) {
        const toolName = call.function.name;
        const args = (call.function.arguments as Record<string, unknown>) || {};

        this.logger.log(
          `Ollama requested tool: "${toolName}" with args: ${JSON.stringify(args)}`,
        );

        const toolResult = await this.executeTool(tools, toolName, args);
        messages.push({ role: 'tool', content: toolResult });
      }

      try {
        response = await this.ollamaClient.chat({
          model: this.model,
          messages,
          tools: ollamaTools,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Ollama failed during tool loop iteration ${iterations}: ${msg}`,
        );
        throw new InternalServerErrorException(
          `Ollama failed while processing tool results: ${msg}`,
        );
      }
    }

    // ── Keyword intent fallback for small models ─────────────────────────────
    let finalText = response.message.content;
    if (!finalText || finalText.trim() === '') {
      finalText = await this.keywordFallback(
        message,
        tools,
        options.isAuthenticated,
      );
    }

    // ── Record token usage and format output ─────────────────────────────────
    const summary = trackUsage(sessionKey, message, finalText);
    return appendUsageHeader(
      finalText,
      summary.usage.totalTokens,
      summary.limit,
      summary.remaining,
    );
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Executes a single MCP tool handler by name, returning text result.
   */
  private async executeTool(
    tools: Record<string, IMcpTool>,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    if (!tools[toolName]) {
      this.logger.warn(`Unknown tool requested: "${toolName}"`);
      return `Error: Unknown tool "${toolName}"`;
    }

    try {
      const result = await tools[toolName].handler(args);
      return result.content.map((c) => c.text).join('\n');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Tool "${toolName}" execution failed: ${msg}`);
      return `Error executing ${toolName}: ${msg}`;
    }
  }

  /**
   * Simple keyword-based fallback for small models that skip tool_calls.
   * Detects obvious intent and directly calls the most appropriate tool.
   */
  private async keywordFallback(
    message: string,
    tools: Record<string, IMcpTool>,
    isAuthenticated = false,
  ): Promise<string> {
    const lower = message.toLowerCase();

    let toolName: string | null = null;
    const args: Record<string, unknown> = {};

    if (
      (lower.includes('user') || lower.includes('users')) &&
      lower.includes('stat')
    ) {
      toolName = 'get_user_stats';
    } else if (lower.includes('user') || lower.includes('users')) {
      toolName = 'list_users';
    } else if (lower.includes('task') || lower.includes('tasks')) {
      toolName = 'list_tasks';
    }

    if (toolName && tools[toolName]) {
      if (!isAuthenticated) {
        return '🔒 Authentication Required: Accessing or querying database records (users, tasks, permissions) requires an active session. Please sign in to your account to execute database tools.';
      }
      this.logger.log(`Keyword fallback triggered for tool: "${toolName}"`);
      return this.executeTool(tools, toolName, args);
    }

    return 'I could not determine what action to take. Please rephrase your request.';
  }
}
