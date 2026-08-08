import { IsArray, IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '../../../common/enums/permission.enum';

export class AssignPermissionsDto {
  @ApiProperty({ description: 'User ID to assign permissions to' })
  @IsString()
  userId: string;

  @ApiProperty({
    enum: Permission,
    isArray: true,
    example: [Permission.TASK_READ, Permission.TASK_CREATE],
  })
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions: Permission[];
}
