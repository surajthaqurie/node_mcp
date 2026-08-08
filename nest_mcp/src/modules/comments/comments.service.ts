import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Task } from '../tasks/entities/task.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async create(
    createCommentDto: CreateCommentDto,
    currentUser: User,
  ): Promise<Comment> {
    const task = await this.taskRepository.findOne({
      where: { id: createCommentDto.taskId },
    });

    if (!task) {
      throw new NotFoundException(`Task #${createCommentDto.taskId} not found`);
    }

    const comment = this.commentRepository.create({
      content: createCommentDto.content,
      taskId: createCommentDto.taskId,
      authorId: currentUser.id,
    });

    const saved = await this.commentRepository.save(comment);
    return this.findOne(saved.id);
  }

  async findAll(
    taskId?: string,
    query?: PaginationQueryDto,
  ): Promise<PaginatedResponse<Comment>> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .leftJoinAndSelect('comment.task', 'task')
      .orderBy('comment.createdAt', 'ASC');

    if (taskId) {
      qb.where('comment.taskId = :taskId', { taskId });
    }

    qb.skip(skip).take(limit);

    const [data, totalItems] = await qb.getManyAndCount();
    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async findByTask(
    taskId: string,
    query?: PaginationQueryDto,
  ): Promise<PaginatedResponse<Comment>> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException(`Task #${taskId} not found`);
    }

    return this.findAll(taskId, query);
  }

  async findOne(id: string): Promise<Comment> {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: { author: true, task: true },
    });

    if (!comment) {
      throw new NotFoundException(`Comment #${id} not found`);
    }

    return comment;
  }

  async update(
    id: string,
    updateCommentDto: UpdateCommentDto,
    currentUser: User,
  ): Promise<Comment> {
    const comment = await this.findOne(id);

    // Only author, Admin, or Manager can update a comment
    if (currentUser.role === Role.USER && comment.authorId !== currentUser.id) {
      throw new ForbiddenException('You can only update your own comments');
    }

    comment.content = updateCommentDto.content;
    return this.commentRepository.save(comment);
  }

  async remove(id: string, currentUser: User): Promise<void> {
    const comment = await this.findOne(id);

    // Only author, Admin, or Manager can delete a comment
    if (currentUser.role === Role.USER && comment.authorId !== currentUser.id) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.commentRepository.remove(comment);
  }
}
