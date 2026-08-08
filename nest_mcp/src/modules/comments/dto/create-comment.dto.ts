import { IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({
    description: 'The comment text content',
    example: 'Great work on this task! Let us move it to testing.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content: string;

  @ApiProperty({
    description: 'ID of the task this comment is attached to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  taskId: string;
}
