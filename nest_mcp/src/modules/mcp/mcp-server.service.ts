/**
 * @file mcp-server.service.ts
 * @description Core MCP server service that initializes an McpServer instance and
 * manages a registry of MCP tools provided by injected ToolProvider services.
 *
 * WHY THIS EXISTS:
 * NestJS dependency injection wires TasksService/UsersService into tools at boot time.
 * This service acts as the single source of truth for all registered MCP tools,
 * exposing a `getTools()` method used by the OllamaService chat loop.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TaskToolsProvider } from './tools/task.tools';
import { UserToolsProvider } from './tools/user.tools';
import { CommentToolsProvider } from './tools/comment.tools';
import { IMcpTool } from './interfaces/mcp-tool.interface';

@Injectable()
export class McpServerService implements OnModuleInit {
  private readonly logger = new Logger(McpServerService.name);
  private server: McpServer;
  private toolRegistry: Record<string, IMcpTool> = {};

  constructor(
    private readonly taskToolsProvider: TaskToolsProvider,
    private readonly userToolsProvider: UserToolsProvider,
    private readonly commentToolsProvider: CommentToolsProvider,
  ) {}

  onModuleInit() {
    this.server = new McpServer({
      name: 'nest-mcp-server',
      version: '1.0.0',
    });

    this.registerProviderTools(this.taskToolsProvider.getTools());
    this.registerProviderTools(this.userToolsProvider.getTools());
    this.registerProviderTools(this.commentToolsProvider.getTools());

    this.logger.log(
      `✅ MCP Server initialized with tools: [${Object.keys(this.toolRegistry).join(', ')}]`,
    );
  }

  /**
   * Registers an array of IMcpTool definitions into the internal tool registry.
   * We maintain our own flat registry (used by OllamaService) rather than
   * calling server.tool() which requires Zod schemas.
   * The McpServer SDK instance is preserved for future SSE/stdio transport use.
   */
  private registerProviderTools(tools: IMcpTool[]): void {
    for (const tool of tools) {
      const toolName: string = tool.name;
      this.toolRegistry[toolName] = tool;
      this.logger.debug(`Registered MCP tool: ${toolName}`);
    }
  }

  /**
   * Returns the flat tool registry used by the Ollama chat loop.
   * Each entry contains the tool definition AND handler function.
   */
  getTools(): Record<string, IMcpTool> {
    return this.toolRegistry;
  }

  /**
   * Returns the underlying McpServer SDK instance
   * (useful for transport layer integration e.g. SSE/stdio).
   */
  getMcpServer(): McpServer {
    return this.server;
  }
}
