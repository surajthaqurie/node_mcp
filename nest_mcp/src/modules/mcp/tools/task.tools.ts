/**
 * @file task.tools.ts
 * @description MCP tool definitions for Task management operations with permission enforcement.
 */

import { Injectable, HttpException } from '@nestjs/common';
import { TasksService } from '../../tasks/tasks.service';
import { CreateTaskDto } from '../../tasks/dto/create-task.dto';
import { IMcpTool } from '../interfaces/mcp-tool.interface';
import { Role } from '../../../common/enums/role.enum';
import { Permission } from '../../../common/enums/permission.enum';
import { User } from '../../users/entities/user.entity';
import {
  TaskStatus,
  TaskPriority,
} from '../../../common/enums/task-status.enum';
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
export class TaskToolsProvider {
  constructor(private readonly tasksService: TasksService) {}

  getTools(): IMcpTool[] {
    return [
      // ─── list_tasks ────────────────────────────────────────────────────────
      {
        name: 'list_tasks',
        description:
          'List all tasks in the system (paginated). Default: page 1, 10 items per page. Returns id, title, description, status, priority, assignee, and creator.',
        inputSchema: {
          type: 'object',
          properties: {
            page: {
              type: 'number',
              description: 'Page number for pagination (default: 1)',
            },
            limit: {
              type: 'number',
              description:
                'Items per page (default: 10, max: 50). Values exceeding 50 are automatically capped at 50 for safety.',
            },
            status: {
              type: 'string',
              enum: Object.values(TaskStatus),
              description: 'Filter tasks by status',
            },
            search: {
              type: 'string',
              description: 'Filter tasks by title search term',
            },
          },
          required: [],
        },
        handler: async (args, user) => {
          const permError = checkPermission(user, Permission.TASK_READ);
          if (permError)
            return { content: [{ type: 'text', text: permError }] };

          const currentUser = user as User;
          const page = Math.max(Number(args.page) || 1, 1);
          const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
          const status = args.status as TaskStatus | undefined;
          const search = args.search as string | undefined;

          const result = await this.tasksService.findAll(currentUser, {
            page,
            limit,
            status,
            search,
          });

          const { data, meta } = result;

          if (data.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No tasks found (Page ${meta.page} of ${meta.totalPages}).`,
                },
              ],
            };
          }

          const itemsText = data
            .map(
              (t) =>
                `ID: ${t.id}\nTitle: ${t.title}\nStatus: ${t.status}\nPriority: ${t.priority}\nAssignee: ${t.assigneeId ?? 'Unassigned'}\nCreated by: ${t.createdById}\nCreated: ${t.createdAt.toISOString()}`,
            )
            .join('\n---\n');

          let banner = '';
          if (meta.totalItems > meta.limit) {
            banner = `⚡ **Paginated View** (Database contains ${meta.totalItems} total tasks. Displaying ${data.length} items on Page ${meta.page} for optimal performance):\n\n`;
          }

          let footer = `\n\n📌 Page ${meta.page} of ${meta.totalPages} (Showing ${data.length} of ${meta.totalItems} total tasks)`;
          if (meta.hasNextPage) {
            footer += `\n💡 **Navigation Options**: Ask to "show page ${meta.page + 1} of tasks" or filter by status to narrow results.`;
          }

          return {
            content: [{ type: 'text', text: banner + itemsText + footer }],
          };
        },
      },

      // ─── get_task ─────────────────────────────────────────────────────────
      {
        name: 'get_task',
        description: 'Get details of a single task by its UUID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The UUID of the task to retrieve',
            },
          },
          required: ['id'],
        },
        handler: async (args, user) => {
          const permError = checkPermission(user, Permission.TASK_READ);
          if (permError)
            return { content: [{ type: 'text', text: permError }] };

          try {
            const currentUser = user as User;
            const task = await this.tasksService.findOne(
              args.id as string,
              currentUser,
            );
            const text = [
              `ID: ${task.id}`,
              `Title: ${task.title}`,
              `Description: ${task.description ?? 'N/A'}`,
              `Status: ${task.status}`,
              `Priority: ${task.priority}`,
              `Due Date: ${task.dueDate ? new Date(task.dueDate).toISOString() : 'N/A'}`,
              `Assignee ID: ${task.assigneeId ?? 'Unassigned'}`,
              `Created by: ${task.createdById}`,
              `Created: ${task.createdAt.toISOString()}`,
              `Updated: ${task.updatedAt.toISOString()}`,
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

      // ─── create_task ──────────────────────────────────────────────────────
      {
        name: 'create_task',
        description:
          'Create a new task in the system. Validates payload fields and asks for confirmation before creation.',
        inputSchema: dtoToInputSchema(CreateTaskDto, {
          confirm: {
            type: 'boolean',
            description:
              'Set to true to confirm creation payload and save task to database.',
          },
        }),
        handler: async (args, user) => {
          const permError = checkPermission(user, Permission.TASK_CREATE);
          if (permError)
            return { content: [{ type: 'text', text: permError }] };

          const title = args.title as string | undefined;
          const isConfirmed = Boolean(args.confirm);

          // Payload Validation Check
          if (!title || title.trim() === '') {
            return {
              content: [
                {
                  type: 'text',
                  text: '⚠️ Payload Validation Failed: Missing required field "title". Please provide a valid title for the task.',
                },
              ],
            };
          }

          // Payload Confirmation Check
          if (!isConfirmed) {
            const preview = [
              '📋 Payload Confirmation Required:',
              'Please review the task payload details before database creation:',
              '',
              `• Title: ${title}`,
              `• Description: ${(args.description as string) || 'N/A'}`,
              `• Status: ${(args.status as string) || TaskStatus.TODO}`,
              `• Priority: ${(args.priority as string) || TaskPriority.MEDIUM}`,
              `• Assignee ID: ${(args.assigneeId as string) || 'Unassigned'}`,
              '',
              'To proceed with creation, please confirm with `confirm: true` (or reply "Confirm task creation").',
            ].join('\n');

            return { content: [{ type: 'text', text: preview }] };
          }

          try {
            const currentUser = user as User;
            const task = await this.tasksService.create(
              {
                title,
                description: args.description as string | undefined,
                status: (args.status as TaskStatus) ?? TaskStatus.TODO,
                priority:
                  (args.priority as TaskPriority) ?? TaskPriority.MEDIUM,
                assigneeId: args.assigneeId as string | undefined,
              },
              currentUser,
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Task created successfully!\nID: ${task.id}\nTitle: ${task.title}\nStatus: ${task.status}\nPriority: ${task.priority}`,
                },
              ],
            };
          } catch (err: unknown) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error creating task: ${getErrorMessage(err)}`,
                },
              ],
            };
          }
        },
      },

      // ─── update_task_status ────────────────────────────────────────────────
      {
        name: 'update_task_status',
        description: 'Update the status of an existing task by its UUID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'UUID of the task to update' },
            status: {
              type: 'string',
              enum: Object.values(TaskStatus),
              description: 'New status value',
            },
          },
          required: ['id', 'status'],
        },
        handler: async (args, user) => {
          const permError = checkPermission(user, Permission.TASK_UPDATE);
          if (permError)
            return { content: [{ type: 'text', text: permError }] };

          try {
            const currentUser = user as User;
            const task = await this.tasksService.update(
              args.id as string,
              { status: args.status as TaskStatus },
              currentUser,
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `Task "${task.title}" status updated to "${task.status}"`,
                },
              ],
            };
          } catch (err: unknown) {
            return {
              content: [
                { type: 'text', text: `Error: ${getErrorMessage(err)}` },
              ],
            };
          }
        },
      },

      // ─── delete_task ──────────────────────────────────────────────────────
      {
        name: 'delete_task',
        description: 'Delete a task permanently by its UUID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'UUID of the task to delete' },
          },
          required: ['id'],
        },
        handler: async (args, user) => {
          const permError = checkPermission(user, Permission.TASK_DELETE);
          if (permError)
            return { content: [{ type: 'text', text: permError }] };

          try {
            const currentUser = user as User;
            await this.tasksService.remove(args.id as string, currentUser);
            return {
              content: [
                {
                  type: 'text',
                  text: `Task ${args.id as string} deleted successfully.`,
                },
              ],
            };
          } catch (err: unknown) {
            return {
              content: [
                { type: 'text', text: `Error: ${getErrorMessage(err)}` },
              ],
            };
          }
        },
      },
    ];
  }
}
