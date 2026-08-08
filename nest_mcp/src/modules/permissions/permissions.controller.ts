import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all available permissions (Admin only)' })
  listAll() {
    return this.permissionsService.listAllPermissions();
  }

  @Get('user/:id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @RequirePermissions(Permission.PERMISSION_MANAGE)
  @ApiOperation({ summary: "Get a user's permissions" })
  getUserPermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.getUserPermissions(id);
  }

  @Post('assign')
  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.PERMISSION_MANAGE)
  @ApiOperation({ summary: 'Assign permissions to a user (Admin only)' })
  assign(@Body() dto: AssignPermissionsDto) {
    return this.permissionsService.assignPermissions(dto);
  }

  @Delete('revoke/:id')
  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.PERMISSION_MANAGE)
  @ApiOperation({ summary: 'Revoke permissions from a user (Admin only)' })
  revoke(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() body: { permissions: string[] },
  ) {
    return this.permissionsService.revokePermissions(userId, body.permissions);
  }
}
