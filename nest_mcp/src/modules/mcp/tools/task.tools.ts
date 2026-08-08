/**
 * @file task.tools.ts
 * @description MCP tool definitions for Task management operations.
 *
 * WHY THIS EXISTS:
 * Exposes TasksService CRUD methods as LLM-callable MCP tools.
 * The Ollama service uses these tools in its function-calling loop to let the
 * AI perform real database operations (list tasks, get task details, create, update, delete).
 *
 * TOOLS REGISTERED:
 * - list_tasks         → Fetch all tasks (admin/manager sees all; user sees own)
 * - get_task           → Get a single task by ID
 * - create_task        → Create a new task (requires title; optional description/status/priority)
 * - update_task_status → Update the status of an existing task
 * - delete_task        → Delete a task by ID
 */

import { Injectable } from '@nestjs/common';
import { TasksService } from '../../tasks/tasks.service';
import { IMcpTool } from '../interfaces/mcp-tool.interface';
import { Role } from '../../../common/enums/role.enum';
import { User } from '../../users/entities/user.entity';
import {
  TaskStatus,
  TaskPriority,
} from '../../../common/enums/task-status.enum';

/** Helper to extract error message safely for ESLint type compliance */
function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Synthetic admin user used by MCP tool calls that require a User context */
const MCP_ADMIN_USER: User = {
  id: 'mcp-system',
  email: 'mcp@system.local',
  firstName: 'MCP',
  lastName: 'System',
  role: Role.ADMIN,
  permissions: [],
  isActive: true,
  password: '',
  tasks: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  get fullName() {
    return 'MCP System';
  },
  hashPassword: () => Promise.resolve(),
  comparePassword: () => Promise.resolve(false),
};

@Injectable()
export class TaskToolsProvider {
  constructor(private readonly tasksService: TasksService) {}

  getTools(): IMcpTool[] {
    return [
      // ─── list_tasks ────────────────────────────────────────────────────────
      {
        name: 'list_tasks',
        description:
          'List all tasks in the system. Returns id, title, description, status, priority, assignee, and creator for each task.',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: Object.values(TaskStatus),
              description:
                'Optional: filter tasks by status (todo, in_progress, done, cancelled)',
            },
          },
          required: [],
        },
        handler: async (args) => {
          const tasks = await this.tasksService.findAll(MCP_ADMIN_USER);
          const filtered = args.status
            ? tasks.filter((t) => t.status === args.status)
            : tasks;

          const text =
            filtered.length === 0
              ? 'No tasks found.'
              : filtered
                  .map(
                    (t) =>
                      `ID: ${t.id}\nTitle: ${t.title}\nStatus: ${t.status}\nPriority: ${t.priority}\nAssignee: ${t.assigneeId ?? 'Unassigned'}\nCreated by: ${t.createdById}\nCreated: ${t.createdAt.toISOString()}`,
                  )
                  .join('\n---\n');

          return { content: [{ type: 'text', text }] };
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
        handler: async (args) => {
          try {
            const task = await this.tasksService.findOne(
              args.id as string,
              MCP_ADMIN_USER,
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
        description: 'Create a new task in the system.',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Task title (required)' },
            description: {
              type: 'string',
              description: 'Optional task description',
            },
            status: {
              type: 'string',
              enum: Object.values(TaskStatus),
              description: 'Initial status (default: todo)',
            },
            priority: {
              type: 'string',
              enum: Object.values(TaskPriority),
              description: 'Task priority (default: medium)',
            },
            assigneeId: {
              type: 'string',
              description: 'UUID of the user to assign this task to',
            },
          },
          required: ['title'],
        },
        handler: async (args) => {
          try {
            const task = await this.tasksService.create(
              {
                title: args.title as string,
                description: args.description as string | undefined,
                status: (args.status as TaskStatus) ?? TaskStatus.TODO,
                priority:
                  (args.priority as TaskPriority) ?? TaskPriority.MEDIUM,
                assigneeId: args.assigneeId as string | undefined,
              },
              MCP_ADMIN_USER,
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `Task created successfully!\nID: ${task.id}\nTitle: ${task.title}\nStatus: ${task.status}\nPriority: ${task.priority}`,
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
        handler: async (args) => {
          try {
            const task = await this.tasksService.update(
              args.id as string,
              { status: args.status as TaskStatus },
              MCP_ADMIN_USER,
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
        handler: async (args) => {
          try {
            await this.tasksService.remove(args.id as string, MCP_ADMIN_USER);
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
