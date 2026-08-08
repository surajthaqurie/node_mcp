/**
 * @file chat.dto.ts
 * @description DTO for the POST /mcp/chat endpoint.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ChatRequestDto {
  @ApiProperty({
    description:
      'The user message to send to the Ollama LLM via MCP tool-calling',
    example: 'List all tasks that are in progress',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}

export class ChatResponseDto {
  @ApiProperty({
    description: 'The AI-generated response',
    example: 'Here are the tasks...',
  })
  response: string;

  @ApiProperty({ description: 'Ollama model used', example: 'qwen2.5:1.5b' })
  model: string;

  @ApiProperty({
    description: 'Processing time in milliseconds',
    example: 1234,
  })
  processingTimeMs: number;
}
