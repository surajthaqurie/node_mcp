/**
 * @file user.tools.ts
 * @description MCP tool definitions for User management operations with permission enforcement.
 */

import { Injectable, HttpException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { IMcpTool } from '../interfaces/mcp-tool.interface';
import { Role } from '../../../common/enums/role.enum';
import { Permission } from '../../../common/enums/permission.enum';
import { User } from '../../users/entities/user.entity';
import { dtoToInputSchema } from '../../../common/utils/dto-to-schema.util';

/** Helper to extract error message safely including NestJS HttpException DTO details */
function getErrorMessage(err: unknown): string {
  if (err instanceof HttpException) {
    const res = err.getResponse();
    if (typeof res === 'object' && res !== null && 'message' in res) {
      const msg = res.message;
      return Array.isArray(msg) ? msg.join(', ') : String(msg);
    }
    if (typeof res === 'string') return res;
  }
  return err instanceof Error ? err.message : String(err);
}

/** Checks if the authenticated user has the required permission */
function checkPermission(
  user: User | null | undefined,
  requiredPermission: Permission,
): string | null {
  if (!user) {
    return '🔒 Authentication Required: Accessing database tools requires an active session. Please sign in to your account.';
  }
  if (user.role === Role.ADMIN) {
    return null; // Admin has full access
  }
  const userPermissions = Array.isArray(user.permissions)
    ? user.permissions
    : [];
  if (!userPermissions.includes(requiredPermission)) {
    return `🚫 Permission Denied: You do not have the required permission ("${requiredPermission}") to perform this action.`;
  }
  return null;
}

@Injectable()
export class UserToolsProvider {
  constructor(private readonly usersService: UsersService) {}

  getTools(): IMcpTool[] {
    return [
      // ─── list_users ─────────────────────────────────────────────────────
      {
        name: 'list_users',
        description:
          'List all registered users in the system (paginated). Default: page 1, 10 items per page. Can filter by role, active status, or search by name/email.',
        inputSchema: {
          type: 'object',
          properties: {
            search: {
              type: 'string',
              description:
                'Optional: search users by name or email (case-insensitive)',
            },
            role: {
              type: 'string',
              enum: Object.values(Role),
              description:
                'Optional: filter users by role (admin, manager, user)',
            },
            activeOnly: {
              type: 'boolean',
              description: 'Optional: if true, only return active users',
            },
            page: {
              type: 'number',
              description: 'Optional: page number (default: 1)',
            },
            limit: {
              type: 'number',
              description: 'Optional: items per page (default: 10)',
            },
          },
          required: [],
        },
        handler: async (args, user) => {
          const permError = checkPermission(user, Permission.USER_READ);
          if (permError)
            return { content: [{ type: 'text', text: permError }] };

          const page = Math.max(Number(args.page) || 1, 1);
          const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
          const role = args.role as Role | undefined;
          const activeOnly = args.activeOnly as boolean | undefined;
          const search = args.search as string | undefined;

          const result = await this.usersService.findAll({
            page,
            limit,
            role,
            activeOnly,
            search,
          });

          const { data, meta } = result;

          if (data.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No users found (Page ${meta.page} of ${meta.totalPages}).`,
                },
              ],
            };
          }

          const itemsText = data
            .map(
              (u) =>
                `ID: ${u.id}\nName: ${u.firstName} ${u.lastName}\nEmail: ${u.email}\nRole: ${u.role}\nActive: ${u.isActive}\nJoined: ${u.createdAt.toISOString()}`,
            )
            .join('\n---\n');

          let banner = '';
          if (meta.totalItems > meta.limit) {
            banner = `⚡ **Paginated View** (Database contains ${meta.totalItems} total users. Displaying ${data.length} items on Page ${meta.page} for optimal performance):\n\n`;
          }

          let footer = `\n\n📌 Page ${meta.page} of ${meta.totalPages} (Showing ${data.length} of ${meta.totalItems} total users)`;
          if (meta.hasNextPage) {
            footer += `\n💡 **Navigation Options**: Ask to "show page ${meta.page + 1} of users" or filter by role/name to narrow results.`;
          }

          return {
            content: [{ type: 'text', text: banner + itemsText + footer }],
          };
        },
      },

      // ─── get_user ────────────────────────────────────────────────────────
      {
        name: 'get_user',
        description: 'Get details of a single user by their UUID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The UUID of the user to retrieve',
            },
          },
          required: ['id'],
        },
        handler: async (args, user) => {
          const permError = checkPermission(user, Permission.USER_READ);
          if (permError)
            return { content: [{ type: 'text', text: permError }] };

          try {
            const foundUser = await this.usersService.findOne(
              args.id as string,
            );
            const text = [
              `ID: ${foundUser.id}`,
              `Name: ${foundUser.firstName} ${foundUser.lastName}`,
              `Email: ${foundUser.email}`,
              `Role: ${foundUser.role}`,
              `Active: ${foundUser.isActive}`,
              `Permissions: ${foundUser.permissions?.join(', ') ?? 'none'}`,
              `Joined: ${foundUser.createdAt.toISOString()}`,
            ].join('\n');
            return { content: [{ type: 'text', text }] };
          } catch (err: unknown) {
            return {
              content: [
                { type: 'text', text: `Error: ${getErrorMessage(err)}` },
              ],
            };
          }
        },
      },

      // ─── get_user_stats ──────────────────────────────────────────────────
      {
        name: 'get_user_stats',
        description:
          'Return aggregate user statistics: total count, count per role, and number of active users.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
        handler: async (_args, user) => {
          const permError = checkPermission(user, Permission.USER_READ);
          if (permError)
            return { content: [{ type: 'text', text: permError }] };

          const result = await this.usersService.findAll({ limit: 1000 });
          const users = result.data;
          const total = result.meta.totalItems;
          const active = users.filter((u) => u.isActive).length;
          const byRole = Object.values(Role).reduce<Record<string, number>>(
            (acc, role) => {
              acc[role] = users.filter((u) => u.role === role).length;
              return acc;
            },
            {},
          );

          const roleLines = Object.entries(byRole)
            .map(([r, c]) => `  ${r}: ${c}`)
            .join('\n');

          const text = `User Statistics\n═══════════════\nTotal Users: ${total}\nActive Users: ${active}\nInactive Users: ${total - active}\n\nBy Role:\n${roleLines}`;
          return { content: [{ type: 'text', text }] };
        },
      },

      // ─── create_user ──────────────────────────────────────────────────────
      {
        name: 'create_user',
        description:
          'Create a new user account (Admin only). Validates required payload fields and requests payload confirmation before saving to database.',
        inputSchema: dtoToInputSchema(CreateUserDto, {
          confirm: {
            type: 'boolean',
            description:
              'Set to true to confirm creation payload and save user to database.',
          },
        }),
        handler: async (args, user) => {
          const permError = checkPermission(user, Permission.USER_CREATE);
          if (permError)
            return { content: [{ type: 'text', text: permError }] };

          const email = args.email as string | undefined;
          const firstName = args.firstName as string | undefined;
          const lastName = args.lastName as string | undefined;
          const password = args.password as string | undefined;
          const role = (args.role as Role) ?? Role.USER;
          const isConfirmed = Boolean(args.confirm);

          // Payload Validation Check
          const missingFields: string[] = [];
          if (!email || email.trim() === '') missingFields.push('email');
          if (!firstName || firstName.trim() === '')
            missingFields.push('firstName');
          if (!lastName || lastName.trim() === '')
            missingFields.push('lastName');
          if (!password || password.trim() === '')
            missingFields.push('password');

          if (missingFields.length > 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `⚠️ Payload Validation Failed: Missing required field(s): [${missingFields.join(', ')}]. Please provide all required fields to proceed.`,
                },
              ],
            };
          }

          // Payload Confirmation Check
          if (!isConfirmed) {
            const preview = [
              '📋 Payload Confirmation Required:',
              'Please review the user payload details before database creation:',
              '',
              `• Email: ${email}`,
              `• First Name: ${firstName}`,
              `• Last Name: ${lastName}`,
              `• Role: ${role}`,
              '• Password: [HIDDEN]',
              '',
              'To proceed with creation, please confirm with `confirm: true` (or reply "Confirm user creation").',
            ].join('\n');

            return { content: [{ type: 'text', text: preview }] };
          }

          try {
            const newUser = await this.usersService.create({
              email: email!,
              firstName: firstName!,
              lastName: lastName!,
              password: password!,
              role,
            });
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ User created successfully!\nID: ${newUser.id}\nEmail: ${newUser.email}\nName: ${newUser.firstName} ${newUser.lastName}\nRole: ${newUser.role}`,
                },
              ],
            };
          } catch (err: unknown) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error creating user: ${getErrorMessage(err)}`,
                },
              ],
            };
          }
        },
      },
    ];
  }
}
