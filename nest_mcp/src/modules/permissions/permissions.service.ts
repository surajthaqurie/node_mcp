import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { User } from '../users/entities/user.entity';
import { Permission } from '../../common/enums/permission.enum';

@Injectable()
export class PermissionsService {
  constructor(private readonly usersService: UsersService) {}

  async assignPermissions(dto: AssignPermissionsDto): Promise<User> {
    return this.usersService.assignPermissions(dto.userId, dto.permissions);
  }

  async revokePermissions(
    userId: string,
    permissions: string[],
  ): Promise<User> {
    const user = await this.usersService.findOne(userId);
    const current = user.permissions ?? [];
    const updated = current.filter((p) => !permissions.includes(p));
    return this.usersService.assignPermissions(userId, updated);
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.usersService.findOne(userId);
    return user.permissions ?? [];
  }

  listAllPermissions(): string[] {
    return Object.values(Permission);
  }
}
