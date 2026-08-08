/**
 * @file user.tools.ts
 * @description MCP tool definitions for User management operations.
 *
 * WHY THIS EXISTS:
 * Exposes UsersService methods as LLM-callable MCP tools so the AI agent can
 * query and manage users through the Ollama function-calling loop.
 *
 * TOOLS REGISTERED:
 * - list_users    → List all registered users (id, email, name, role, isActive)
 * - get_user      → Get a single user by UUID
 * - get_user_stats→ Return aggregate stats (total users, count by role, active count)
 */

import { Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { IMcpTool } from '../interfaces/mcp-tool.interface';
import { Role } from '../../../common/enums/role.enum';

/** Helper to extract error message safely for ESLint type compliance */
function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
          'List all registered users in the system. Returns id, email, firstName, lastName, role, isActive, and createdAt for each user.',
        inputSchema: {
          type: 'object',
          properties: {
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
          },
          required: [],
        },
        handler: async (args) => {
          let users = await this.usersService.findAll();

          if (args.role) {
            users = users.filter((u) => u.role === args.role);
          }
          if (args.activeOnly === true) {
            users = users.filter((u) => u.isActive);
          }

          const text =
            users.length === 0
              ? 'No users found.'
              : users
                  .map(
                    (u) =>
                      `ID: ${u.id}\nName: ${u.firstName} ${u.lastName}\nEmail: ${u.email}\nRole: ${u.role}\nActive: ${u.isActive}\nJoined: ${u.createdAt.toISOString()}`,
                  )
                  .join('\n---\n');

          return { content: [{ type: 'text', text }] };
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
        handler: async (args) => {
          try {
            const user = await this.usersService.findOne(args.id as string);
            const text = [
              `ID: ${user.id}`,
              `Name: ${user.firstName} ${user.lastName}`,
              `Email: ${user.email}`,
              `Role: ${user.role}`,
              `Active: ${user.isActive}`,
              `Permissions: ${user.permissions?.join(', ') ?? 'none'}`,
              `Joined: ${user.createdAt.toISOString()}`,
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
        handler: async () => {
          const users = await this.usersService.findAll();
          const total = users.length;
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
    ];
  }
}
