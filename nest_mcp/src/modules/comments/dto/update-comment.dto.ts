import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCommentDto {
  @ApiProperty({
    description: 'Updated comment text content',
    example: 'Updated status: testing completed successfully.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content: string;
}
