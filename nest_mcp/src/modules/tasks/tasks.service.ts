import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async create(createTaskDto: CreateTaskDto, currentUser: User): Promise<Task> {
    const task = this.taskRepository.create({
      ...createTaskDto,
      createdById: currentUser.id,
    });
    return this.taskRepository.save(task);
  }

  async findAll(
    currentUser: User,
    query?: PaginationQueryDto & { status?: TaskStatus },
  ): Promise<PaginatedResponse<Task>> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .orderBy('task.createdAt', 'DESC');

    // Non-admins/managers see only their own tasks
    if (currentUser.role !== Role.ADMIN && currentUser.role !== Role.MANAGER) {
      qb.where('(task.createdById = :id OR task.assigneeId = :id)', {
        id: currentUser.id,
      });
    }

    if (query?.status) {
      qb.andWhere('task.status = :status', { status: query.status });
    }

    qb.skip(skip).take(limit);

    const [data, totalItems] = await qb.getManyAndCount();
    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async findOne(id: string, currentUser: User): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: { createdBy: true, assignee: true },
    });

    if (!task) throw new NotFoundException(`Task #${id} not found`);

    // Ownership check for regular users
    if (
      currentUser.role === Role.USER &&
      task.createdById !== currentUser.id &&
      task.assigneeId !== currentUser.id
    ) {
      throw new ForbiddenException('You do not have access to this task');
    }

    return task;
  }

  async update(
    id: string,
    updateTaskDto: UpdateTaskDto,
    currentUser: User,
  ): Promise<Task> {
    const task = await this.findOne(id, currentUser);

    if (currentUser.role === Role.USER && task.createdById !== currentUser.id) {
      throw new ForbiddenException('You can only update tasks you created');
    }

    Object.assign(task, updateTaskDto);
    return this.taskRepository.save(task);
  }

  async remove(id: string, currentUser: User): Promise<void> {
    const task = await this.findOne(id, currentUser);

    if (currentUser.role === Role.USER && task.createdById !== currentUser.id) {
      throw new ForbiddenException('You can only delete tasks you created');
    }

    await this.taskRepository.remove(task);
  }

  async getMyTasks(
    currentUser: User,
    query?: PaginationQueryDto,
  ): Promise<PaginatedResponse<Task>> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .where('(task.createdById = :id OR task.assigneeId = :id)', {
        id: currentUser.id,
      })
      .orderBy('task.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, totalItems] = await qb.getManyAndCount();
    return createPaginatedResponse(data, totalItems, page, limit);
  }
}
