/**
 * @file task-query.dto.ts
 * @description Query DTO for paginated task retrieval, status filtering, and search.
 */

import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { TaskStatus } from '../../../common/enums/task-status.enum';

export class TaskQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: TaskStatus,
    description: 'Filter tasks by status (todo, in_progress, completed)',
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    description: 'Filter tasks by title search query',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
