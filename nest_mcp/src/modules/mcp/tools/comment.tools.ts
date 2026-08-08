/**
 * @file comment.tools.ts
 * @description MCP tool definitions for Comment management operations with permission enforcement.
 */

import { Injectable, HttpException } from '@nestjs/common';
import { CommentsService } from '../../comments/comments.service';
import { CreateCommentDto } from '../../comments/dto/create-comment.dto';
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
export class CommentToolsProvider {
  constructor(private readonly commentsService: CommentsService) {}

  getTools(): IMcpTool[] {
    return [
      // ─── list_comments ──────────────────────────────────────────────────────
      {
        name: 'list_comments',
        description:
          'List all comments in the system (paginated). Default: page 1, 10 items per page. Can be filtered by a specific taskId.',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Optional UUID of the task to filter comments for',
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
          const permError = checkPermission(user, Permission.COMMENT_READ);
          if (permError)
            return { content: [{ type: 'text', text: permError }] };

          try {
            const page = Number(args.page) || 1;
            const limit = Number(args.limit) || 10;
            const taskId = args.taskId as string | undefined;

            const result = await this.commentsService.findAll(taskId, {
              page,
              limit,
            });

            const { data, meta } = result;

            if (data.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `No comments found (Page ${meta.page} of ${meta.totalPages}).`,
                  },
                ],
              };
            }

            const itemsText = data
              .map(
                (c) =>
                  `ID: ${c.id}\nContent: ${c.content}\nTask ID: ${c.taskId}\nAuthor ID: ${c.authorId}\nCreated: ${c.createdAt.toISOString()}`,
              )
              .join('\n---\n');

            let footer = `\n\n📌 Page ${meta.page} of ${meta.totalPages} (Showing ${data.length} of ${meta.totalItems} total comments)`;
            if (meta.hasNextPage) {
              footer += `\n💡 More items available. Ask to "show page ${meta.page + 1} of comments" to see more.`;
            }

            return { content: [{ type: 'text', text: itemsText + footer }] };
          } catch (err: unknown) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error listing comments: ${getErrorMessage(err)}`,
                },
              ],
            };
          }
        },
      },

      // ─── get_comment ───────────────────────────────────────────────────────
      {
        name: 'get_comment',
        description: 'Get details of a single comment by its UUID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The UUID of the comment to retrieve',
            },
          },
          required: ['id'],
        },
        handler: async (args, user) => {
          const permError = checkPermission(user, Permission.COMMENT_READ);
          if (permError)
            return { content: [{ type: 'text', text: permError }] };

          try {
            const comment = await this.commentsService.findOne(
              args.id as string,
            );
            const text = [
              `ID: ${comment.id}`,
              `Content: ${comment.content}`,
              `Task ID: ${comment.taskId}`,
              `Author ID: ${comment.authorId}`,
              `Created: ${comment.createdAt.toISOString()}`,
              `Updated: ${comment.updatedAt.toISOString()}`,
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

      // ─── create_comment ────────────────────────────────────────────────────
      {
        name: 'create_comment',
        description:
          'Create a new comment on a task. Validates payload fields and asks for confirmation before creation.',
        inputSchema: dtoToInputSchema(CreateCommentDto, {
          confirm: {
            type: 'boolean',
            description:
              'Set to true to confirm creation payload and save comment to database.',
          },
        }),
        handler: async (args, user) => {
          const permError = checkPermission(user, Permission.COMMENT_CREATE);
          if (permError)
            return { content: [{ type: 'text', text: permError }] };

          const taskId = args.taskId as string | undefined;
          const contentText = args.content as string | undefined;
          const isConfirmed = Boolean(args.confirm);

          // Payload Validation Check
          const missingFields: string[] = [];
          if (!taskId || taskId.trim() === '') missingFields.push('taskId');
          if (!contentText || contentText.trim() === '')
            missingFields.push('content');

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
              'Please review the comment payload details before database creation:',
              '',
              `• Task ID: ${taskId}`,
              `• Content: ${contentText}`,
              '',
              'To proceed with creation, please confirm with `confirm: true` (or reply "Confirm comment creation").',
            ].join('\n');

            return { content: [{ type: 'text', text: preview }] };
          }

          try {
            const currentUser = user as User;
            const comment = await this.commentsService.create(
              {
                taskId: taskId!,
                content: contentText!,
              },
              currentUser,
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `✅ Comment added successfully!\nID: ${comment.id}\nTask ID: ${comment.taskId}\nContent: ${comment.content}`,
                },
              ],
            };
          } catch (err: unknown) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error creating comment: ${getErrorMessage(err)}`,
                },
              ],
            };
          }
        },
      },

      // ─── delete_comment ────────────────────────────────────────────────────
      {
        name: 'delete_comment',
        description: 'Delete a comment permanently by its UUID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'UUID of the comment to delete',
            },
          },
          required: ['id'],
        },
        handler: async (args, user) => {
          const permError = checkPermission(user, Permission.COMMENT_DELETE);
          if (permError)
            return { content: [{ type: 'text', text: permError }] };

          try {
            const currentUser = user as User;
            await this.commentsService.remove(args.id as string, currentUser);
            return {
              content: [
                {
                  type: 'text',
                  text: `Comment ${args.id as string} deleted successfully.`,
                },
              ],
            };
          } catch (err: unknown) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error deleting comment: ${getErrorMessage(err)}`,
                },
              ],
            };
          }
        },
      },
    ];
  }
}
