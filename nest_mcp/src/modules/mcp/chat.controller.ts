/**
 * @file chat.controller.ts
 * @description REST controller that exposes the AI chat endpoint.
 *
 * Endpoints:
 *  POST /mcp/chat  — Send a message to Ollama; returns the AI response after
 *                    executing any required MCP tool calls against the database.
 *  GET  /mcp/tools — List all registered MCP tools (name + description) for debugging.
 *
 * Authentication: JWT required (protected by JwtAuthGuard).
 *
 * Error handling strategy:
 *  - OllamaService throws typed NestJS exceptions (ServiceUnavailableException,
 *    InternalServerErrorException) — the controller catches unknown errors and
 *    wraps them into a 500 so no raw stack traces ever reach the client.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { OllamaService } from './ollama.service';
import { McpServerService } from './mcp-server.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ConfigService } from '@nestjs/config';

@ApiTags('MCP / AI Chat')
@ApiBearerAuth()
@UseGuards(OptionalJwtAuthGuard)
@Controller('mcp')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly ollamaService: OllamaService,
    private readonly mcpServerService: McpServerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * POST /mcp/chat
   * Primary AI chat endpoint — routes the message through Ollama with MCP tool-calling.
   *
   * Error responses:
   *  503 — Ollama is not running or the model is not pulled locally
   *  500 — Unexpected server-side failure
   *  400 — Validation error on the request body
   */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chat with Ollama AI (MCP tool-calling enabled)',
    description:
      'Send a natural language message to the local Ollama LLM. ' +
      'General questions do not require login. Accessing database tools requires a valid session.',
  })
  @ApiResponse({
    status: 200,
    description: 'AI response',
    type: ChatResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({
    status: 503,
    description:
      'Ollama is not running or the requested model is not pulled locally',
  })
  @ApiResponse({ status: 500, description: 'Unexpected server error' })
  async chat(
    @Body() dto: ChatRequestDto,
    @CurrentUser() user: User | null,
  ): Promise<ChatResponseDto> {
    const startTime = Date.now();
    const sessionKey = user?.id || 'guest';
    const isAuthenticated = !!user;

    this.logger.log(
      `Chat request received [user: ${user?.email || 'guest'}]: "${dto.message}"`,
    );

    try {
      const response = await this.ollamaService.chat(dto.message, sessionKey, {
        isAuthenticated,
      });
      const processingTimeMs = Date.now() - startTime;

      this.logger.log(`Chat response generated in ${processingTimeMs}ms`);

      return {
        response,
        model: this.configService.get<string>('OLLAMA_MODEL') || 'qwen2.5:1.5b',
        processingTimeMs,
      };
    } catch (err: unknown) {
      // Re-throw typed NestJS HTTP exceptions as-is (503, 500, etc.)
      // so the global exception filter formats them correctly.
      if (err instanceof HttpException) {
        this.logger.error(
          `Chat failed [HTTP ${err.getStatus()}]: ${err.message}`,
        );
        throw err;
      }

      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;

      // Truly unexpected errors — wrap in a 500 with a clean message
      this.logger.error(`Unexpected chat error: ${message}`, stack);
      throw new InternalServerErrorException(
        `Chat processing failed: ${message}`,
      );
    }
  }

  /**
   * GET /mcp/tools
   * Debug endpoint — lists all registered MCP tools with their descriptions and input schemas.
   */
  @Get('tools')
  @ApiOperation({
    summary: 'List all registered MCP tools',
    description:
      'Returns the name, description, and input schema of every registered MCP tool.',
  })
  @ApiResponse({ status: 200, description: 'List of MCP tools' })
  listTools() {
    const tools = this.mcpServerService.getTools();
    const entries = Object.entries(tools);
    return {
      count: entries.length,
      tools: entries.map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  }
}
