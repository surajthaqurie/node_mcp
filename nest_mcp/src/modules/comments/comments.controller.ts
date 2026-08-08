import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @RequirePermissions(Permission.COMMENT_CREATE)
  @ApiOperation({ summary: 'Create a comment on a task' })
  create(
    @Body() createCommentDto: CreateCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.commentsService.create(createCommentDto, user);
  }

  @Get()
  @RequirePermissions(Permission.COMMENT_READ)
  @ApiOperation({
    summary: 'Get all comments (paginated, optionally filtered by taskId)',
  })
  @ApiQuery({ name: 'taskId', required: false, type: String })
  findAll(
    @Query('taskId') taskId?: string,
    @Query() query?: PaginationQueryDto,
  ) {
    return this.commentsService.findAll(taskId, query);
  }

  @Get('task/:taskId')
  @RequirePermissions(Permission.COMMENT_READ)
  @ApiOperation({ summary: 'Get all comments for a specific task (paginated)' })
  findByTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() query?: PaginationQueryDto,
  ) {
    return this.commentsService.findByTask(taskId, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.COMMENT_READ)
  @ApiOperation({ summary: 'Get comment by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.commentsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.COMMENT_UPDATE)
  @ApiOperation({ summary: 'Update a comment' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.commentsService.update(id, updateCommentDto, user);
  }

  @Delete(':id')
  @RequirePermissions(Permission.COMMENT_DELETE)
  @ApiOperation({ summary: 'Delete a comment' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.commentsService.remove(id, user);
  }
}
