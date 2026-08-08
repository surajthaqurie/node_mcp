import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../../common/enums/role.enum';
import { Permission } from '../../common/enums/permission.enum';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from '../../common/dto/pagination.dto';
import { createPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = this.userRepository.create(createUserDto);
    return this.userRepository.save(user);
  }

  async findAll(
    query?: PaginationQueryDto & { role?: Role; activeOnly?: boolean },
  ): Promise<PaginatedResponse<User>> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
        'user.role',
        'user.permissions',
        'user.isActive',
        'user.createdAt',
      ])
      .orderBy('user.createdAt', 'DESC');

    if (query?.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }
    if (query?.activeOnly === true) {
      qb.andWhere('user.isActive = :isActive', { isActive: true });
    }

    qb.skip(skip).take(limit);

    const [data, totalItems] = await qb.getManyAndCount();
    return createPaginatedResponse(data, totalItems, page, limit);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return this.userRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }

  async assignPermissions(id: string, permissions: string[]): Promise<User> {
    const user = await this.findOne(id);
    user.permissions = permissions;
    return this.userRepository.save(user);
  }

  async seedAdmin(): Promise<void> {
    const admin = await this.findByEmail('admin@nest-mcp.com');
    if (!admin) {
      await this.create({
        email: 'admin@nest-mcp.com',
        firstName: 'Super',
        lastName: 'Admin',
        password: 'Admin@12345',
        role: Role.ADMIN,
        permissions: Object.values(Permission),
      });
      console.log('✅ Admin seeded: admin@nest-mcp.com / Admin@12345');
    }
  }
}
