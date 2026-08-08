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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @RequirePermissions(Permission.TASK_CREATE)
  @ApiOperation({ summary: 'Create a new task' })
  create(@Body() createTaskDto: CreateTaskDto, @CurrentUser() user: User) {
    return this.tasksService.create(createTaskDto, user);
  }

  @Get()
  @RequirePermissions(Permission.TASK_READ)
  @ApiOperation({ summary: 'Get all tasks (paginated & role-filtered)' })
  findAll(@Query() query: PaginationQueryDto, @CurrentUser() user: User) {
    return this.tasksService.findAll(user, query);
  }

  @Get('my-tasks')
  @ApiOperation({
    summary: 'Get tasks assigned to or created by me (paginated)',
  })
  getMyTasks(@Query() query: PaginationQueryDto, @CurrentUser() user: User) {
    return this.tasksService.getMyTasks(user, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.TASK_READ)
  @ApiOperation({ summary: 'Get task by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.tasksService.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermissions(Permission.TASK_UPDATE)
  @ApiOperation({ summary: 'Update a task' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.update(id, updateTaskDto, user);
  }

  @Delete(':id')
  @RequirePermissions(Permission.TASK_DELETE)
  @ApiOperation({ summary: 'Delete a task' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.tasksService.remove(id, user);
  }
}
