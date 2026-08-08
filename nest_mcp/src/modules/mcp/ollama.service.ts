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
import { User } from '../users/entities/user.entity';
import {
  buildOllamaTools,
  buildSystemPrompt,
  checkTokenLimit,
  trackUsage,
  appendUsageHeader,
  McpSessionState,
  isCreationIntent,
  isConfirmationIntent,
  extractUserParams,
  extractTaskParams,
  extractSearchQuery,
} from './utils/index';

@Injectable()
export class OllamaService implements OnModuleInit {
  private readonly logger = new Logger(OllamaService.name);
  private ollamaClient: Ollama;
  private model: string;
  private readonly sessionState = new McpSessionState();

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
    options: { user?: User | null; isAuthenticated?: boolean } = {},
  ): Promise<string> {
    // ── Token limit check ───────────────────────────────────────────────────
    const limitError = checkTokenLimit(sessionKey, message);
    if (limitError) {
      throw new BadRequestException(limitError);
    }

    // ── Conversational Check (Greetings & General Chat) ─────────────────────
    const conversationalReply = this.handleConversationalMessage(message);
    if (conversationalReply) {
      const summary = trackUsage(sessionKey, message, conversationalReply);
      return appendUsageHeader(
        conversationalReply,
        summary.usage.totalTokens,
        summary.limit,
        summary.remaining,
      );
    }

    const tools = this.mcpServerService.getTools();

    // ── Fast-path Keyword Fallback for Obvious Tool Requests ─────────────────
    const fastPathText = await this.keywordFallback(
      message,
      tools,
      options.isAuthenticated,
      options.user,
    );
    if (
      fastPathText &&
      !fastPathText.startsWith('I am here to help! Please ask a question')
    ) {
      const summary = trackUsage(sessionKey, message, fastPathText);
      return appendUsageHeader(
        fastPathText,
        summary.usage.totalTokens,
        summary.limit,
        summary.remaining,
      );
    }

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

        const toolResult = await this.executeTool(
          tools,
          toolName,
          args,
          options.user,
        );
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

    // If Ollama didn't execute any tools (iterations === 0), run keyword fallback
    // to ensure intent-based actions (creation, pagination, query tools) execute reliably!
    if (iterations === 0) {
      const fallbackText = await this.keywordFallback(
        message,
        tools,
        options.isAuthenticated,
        options.user,
      );
      if (
        fallbackText &&
        fallbackText !==
          'I am here to help! Please ask a question or specify an action for tasks, users, or comments.'
      ) {
        finalText = fallbackText;
      }
    }

    // ── Re-verification check for ambiguous LLM responses ───────────────────
    if (this.isConfusedResponse(finalText)) {
      finalText = [
        '🤔 **Re-verification & Clarification Required**',
        "I couldn't quite determine your intent from that prompt. Could you please clarify your request or select one of the suggested actions below?",
        '',
        '💡 **Suggested Actions**:',
        '• 📋 **Tasks**: "List all tasks" or "Create a task titled [title]"',
        '• 👥 **Users**: "List all users" or "Get user stats"',
        '• 💬 **Comments**: "List all comments" or "Add a comment on task [id]"',
      ].join('\n');
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
   * Detects casual conversational greetings & general questions to avoid triggering hallucinated tool calls.
   */
  private handleConversationalMessage(message: string): string | null {
    const lower = message.trim().toLowerCase();

    // If message contains explicit database action intent, pass through to tools
    const actionKeywords = [
      'list',
      'get',
      'create',
      'update',
      'delete',
      'show',
      'fetch',
      'find',
      'search',
      'add',
      'remove',
      'task',
      'tasks',
      'user',
      'users',
      'comment',
      'comments',
      'stat',
      'stats',
      'page',
      'count',
      'detail',
      'details',
    ];

    const hasActionIntent = actionKeywords.some((k) => lower.includes(k));
    if (hasActionIntent) return null;

    if (
      lower.includes('what are you doing') ||
      lower.includes('what r u doing') ||
      lower.includes('wbu') ||
      lower.includes('wyd')
    ) {
      return 'Hello! 👋 I am active and ready to assist you! I can help you manage tasks, look up users, handle comments, or answer general questions.';
    }

    const greetings = [
      'hlw',
      'hello',
      'hi',
      'hey',
      'helo',
      'hallo',
      'hola',
      'hy',
      'greetings',
      'good morning',
      'good afternoon',
      'good evening',
      'wassup',
      'sup',
      'howdy',
    ];

    if (
      greetings.some(
        (g) =>
          lower === g || lower.startsWith(g + ' ') || lower.endsWith(' ' + g),
      )
    ) {
      return 'Hello! 👋 How can I assist you today? Feel free to ask general questions or manage your tasks, users, and comments!';
    }

    if (
      lower.includes('who are you') ||
      lower.includes('what can you do') ||
      lower === 'help'
    ) {
      return (
        '🤖 **I am your NestMCP AI Assistant!**\n\n' +
        'Here is what I can do:\n' +
        '- **General Knowledge**: Ask me general questions anytime without logging in.\n' +
        '- **Task Management**: List, create, update, or inspect tasks.\n' +
        '- **User Directory**: View user profiles, stats, and access controls.\n' +
        '- **Comments**: Manage task comments and discussion threads.'
      );
    }

    if (lower.includes('thank') || lower === 'thx') {
      return "You're very welcome! Let me know if you need anything else. 😊";
    }

    return null;
  }

  /**
   * Helper to check if the LLM output is ambiguous, empty, or confused.
   */
  private isConfusedResponse(text: string): boolean {
    if (!text || text.trim() === '') return true;
    const lower = text.toLowerCase();
    const confusionPhrases = [
      "i don't understand",
      'i am confused',
      'could not understand',
      "sorry, i don't know",
      'unclear prompt',
      'invalid request',
      'not sure what you mean',
    ];
    return confusionPhrases.some((phrase) => lower.includes(phrase));
  }

  /**
   * Executes a single MCP tool handler by name, returning text result.
   */
  private async executeTool(
    tools: Record<string, IMcpTool>,
    toolName: string,
    args: Record<string, unknown>,
    user?: User | null,
  ): Promise<string> {
    if (!tools[toolName]) {
      this.logger.warn(`Unknown tool requested: "${toolName}"`);
      return `Error: Unknown tool "${toolName}"`;
    }

    try {
      this.sessionState.trackListOperation(toolName, Number(args.page) || 1);
      const result = await tools[toolName].handler(args, user);
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
    user?: User | null,
  ): Promise<string> {
    const lower = message.trim().toLowerCase();

    // ── Greeting Detection ───────────────────────────────────────────────────
    const greetings = [
      'hlw',
      'hello',
      'hi',
      'hey',
      'helo',
      'hallo',
      'hola',
      'hy',
      'greetings',
      'good morning',
      'good afternoon',
      'good evening',
      'wassup',
      'sup',
      'howdy',
    ];
    if (
      greetings.some(
        (g) =>
          lower === g || lower.startsWith(g + ' ') || lower.endsWith(' ' + g),
      )
    ) {
      return 'Hello! 👋 How can I assist you today? Feel free to ask general questions or query your tasks, users, and comments!';
    }

    // ── Gratitude & Help Detection ───────────────────────────────────────────
    if (lower.includes('thank') || lower === 'thx') {
      return "You're very welcome! Let me know if you need anything else. 😊";
    }

    if (
      lower.includes('who are you') ||
      lower.includes('what can you do') ||
      lower === 'help'
    ) {
      return (
        '🤖 **I am your NestMCP AI Assistant!**\n\n' +
        'Here is what I can do:\n' +
        '- **General Knowledge**: Ask me general questions anytime without logging in.\n' +
        '- **Task Management**: List, create, update, or inspect tasks.\n' +
        '- **User Directory**: View user profiles, stats, and access controls.\n' +
        '- **Comments**: Manage task comments and discussion threads.'
      );
    }

    let toolName: string | null = null;
    const args: Record<string, unknown> = {};

    // ── Relative Page Navigation ("next", "next page", "prev", "previous") ───
    const isNext =
      lower === 'next' ||
      lower === 'next page' ||
      lower === 'next p' ||
      lower === 'n';
    const isPrev =
      lower === 'prev' ||
      lower === 'previous' ||
      lower === 'prev page' ||
      lower === 'previous page' ||
      lower === 'p';

    if (isNext) {
      this.sessionState.setPage(this.sessionState.getPage() + 1);
      args.page = this.sessionState.getPage();
      toolName = this.sessionState.getListTool();
    } else if (isPrev) {
      this.sessionState.setPage(this.sessionState.getPage() - 1);
      args.page = this.sessionState.getPage();
      toolName = this.sessionState.getListTool();
    }

    // ── Extract Page and Limit Parameters ─────────────────────────────────────
    const pageMatch = lower.match(/(?:page|p)\s*=?\s*(\d+)/i);
    if (pageMatch && pageMatch[1]) {
      args.page = Number(pageMatch[1]);
    }

    const limitMatch = lower.match(
      /(?:limit|count|size|per page)\s*=?\s*(\d+)/i,
    );
    if (limitMatch && limitMatch[1]) {
      args.limit = Number(limitMatch[1]);
    }

    // ── Check Intent via IntentParser Utility ─────────────────────────────────
    const isCreation = isCreationIntent(lower);
    const isConfirm = isConfirmationIntent(lower);
    const pendingTool = this.sessionState.getPendingTool();

    if (isCreation) {
      if (lower.includes('task') || lower.includes('tasks')) {
        toolName = 'create_task';
        Object.assign(args, extractTaskParams(message, args));
        if (isConfirm) args.confirm = true;
      } else if (lower.includes('user') || lower.includes('users')) {
        toolName = 'create_user';
        Object.assign(args, extractUserParams(message, args));
        if (isConfirm) args.confirm = true;
      } else if (lower.includes('comment') || lower.includes('comments')) {
        toolName = 'create_comment';
        if (isConfirm) args.confirm = true;
      }
    } else if (pendingTool) {
      // Continuation of a pending creation request
      toolName = pendingTool;
      if (toolName === 'create_user') {
        Object.assign(
          args,
          this.sessionState.getPendingArgs(),
          extractUserParams(message, {}),
        );
      } else if (toolName === 'create_task') {
        Object.assign(
          args,
          this.sessionState.getPendingArgs(),
          extractTaskParams(message, {}),
        );
      }
      if (isConfirm) args.confirm = true;
    }

    // ── Tool Selection for Queries ────────────────────────────────────────────
    if (!toolName) {
      if (
        (lower.includes('user') || lower.includes('users')) &&
        lower.includes('stat')
      ) {
        toolName = 'get_user_stats';
      } else if (
        lower.includes('user') ||
        lower.includes('users') ||
        (args.page !== undefined &&
          !lower.includes('task') &&
          !lower.includes('comment'))
      ) {
        toolName = 'list_users';
        const search = extractSearchQuery(message);
        if (search) args.search = search;
      } else if (lower.includes('task') || lower.includes('tasks')) {
        toolName = 'list_tasks';
        const search = extractSearchQuery(message);
        if (search) args.search = search;
      } else if (lower.includes('comment') || lower.includes('comments')) {
        toolName = 'list_comments';
      }
    }

    if (toolName && tools[toolName]) {
      if (!isAuthenticated) {
        return '🔒 Authentication Required: Accessing or querying database records (users, tasks, permissions) requires an active session. Please sign in to your account to execute database tools.';
      }
      this.logger.log(
        `Keyword fallback triggered for tool: "${toolName}", args: ${JSON.stringify(args)}`,
      );

      const resultText = await this.executeTool(tools, toolName, args, user);
      this.sessionState.handleToolOutcome(toolName, args, resultText);
      return resultText;
    }

    return 'I am here to help! Please ask a question or specify an action for tasks, users, or comments.';
  }
}
