/**
 * @file mcp.module.ts
 * @description NestJS module that wires together the MCP server, Ollama LLM,
 * and all registered tool providers (Tasks, Users) into a cohesive AI chat feature.
 */

import { Module } from '@nestjs/common';
import { McpServerService } from './mcp-server.service';
import { OllamaService } from './ollama.service';
import { ChatController } from './chat.controller';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { TaskToolsProvider } from './tools/task.tools';
import { UserToolsProvider } from './tools/user.tools';

@Module({
  imports: [TasksModule, UsersModule],
  providers: [
    McpServerService,
    OllamaService,
    TaskToolsProvider,
    UserToolsProvider,
  ],
  controllers: [ChatController],
  exports: [McpServerService, OllamaService],
})
export class McpModule {}
