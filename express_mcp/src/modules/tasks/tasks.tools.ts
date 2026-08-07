import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AuthUser } from "../auth/auth.dto.js";
import {
  createTask,
  getTasks,
  updateTaskStatus,
  deleteTask,
  getTaskCountsByUser,
  getDeletedTaskCountsByUser,
} from "./tasks.service.js";

/**
 * Helper to format task list into a Markdown Table response.
 */
function formatTasksTable(data: any[], pagination: any): string {
  if (data.length === 0) return "No tasks found.";

  const header = `### 📋 Tasks List (Page ${pagination.page} of ${pagination.totalPages} | Total: ${pagination.total})\n\n`;
  const tableHeader = `| ID | Title | Description | Status | Created At |\n| :--- | :--- | :--- | :--- | :--- |\n`;
  const tableRows = data
    .map(
      (t) =>
        `| \`${t.id}\` | **${t.title}** | ${t.description || "-"} | \`${t.status}\` | ${new Date(t.createdAt || t.created_at).toLocaleDateString()} |`,
    )
    .join("\n");

  return header + tableHeader + tableRows;
}

export function registerTaskTools(server: McpServer, user?: AuthUser) {
  const currentUserId = user?.userId || "demo-user-123";

  // 1. Create Task Tool
  server.registerTool(
    "create_task",
    {
      title: "Create Task",
      description: "Create a new task for the authenticated user",
      inputSchema: {
        title: z.string().min(1, "Title is required").describe("Task title"),
        description: z.string().optional().describe("Task description"),
        status: z
          .enum(["PENDING", "IN_PROGRESS", "COMPLETED"])
          .optional()
          .describe("Initial task status"),
      },
    },
    async ({ title, description, status }) => {
      try {
        const task = await createTask({
          title,
          description,
          status,
          userId: currentUserId,
        });

        return {
          content: [
            {
              type: "text",
              text: `Task created successfully:\n${JSON.stringify(task, null, 2)}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Error creating task: ${err.message}` },
          ],
        };
      }
    },
  );

  // 2. List Tasks Tool (Paginated & Markdown Table Response)
  server.registerTool(
    "list_tasks",
    {
      title: "List Tasks",
      description: "List tasks owned by the authenticated user with pagination",
      inputSchema: {
        status: z
          .enum(["PENDING", "IN_PROGRESS", "COMPLETED"])
          .optional()
          .describe("Filter by status"),
        page: z.number().optional().describe("Page number (default: 1)"),
        limit: z.number().optional().describe("Items per page (default: 10)"),
      },
    },
    async ({ status, page = 1, limit = 10 }) => {
      try {
        const result = await getTasks(currentUserId, status, page, limit);
        const markdownTable = formatTasksTable(result.data, result.pagination);
        return {
          content: [
            {
              type: "text",
              text: markdownTable,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Error fetching tasks: ${err.message}` },
          ],
        };
      }
    },
  );

  // 3. Get Task Counts by User Tool
  server.registerTool(
    "get_task_counts_by_user",
    {
      title: "Get task counts by user",
      description: "Show how many tasks each user has (admin-friendly summary)",
      inputSchema: {},
    },
    async () => {
      try {
        const rows = await getTaskCountsByUser();
        if (!rows.length) {
          return { content: [{ type: "text", text: "No tasks found." }] };
        }

        const lines = rows.map(
          (row) => `- ${row.userId}: ${row.taskCount} task(s)`,
        );
        return {
          content: [
            {
              type: "text",
              text: `### 📊 Task Count by User\n\n${lines.join("\n")}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching task counts: ${err.message}`,
            },
          ],
        };
      }
    },
  );

  // 4. Get Deleted Task Counts by User Tool
  server.registerTool(
    "get_deleted_task_counts_by_user",
    {
      title: "Get deleted task counts by user",
      description: "Show how many tasks have been deleted for each owner user",
      inputSchema: {},
    },
    async () => {
      try {
        const rows = await getDeletedTaskCountsByUser();
        if (!rows.length) {
          return {
            content: [{ type: "text", text: "No deleted tasks found." }],
          };
        }

        const lines = rows.map(
          (row) => `- ${row.userId}: ${row.deletedTaskCount} deleted task(s)`,
        );
        return {
          content: [
            {
              type: "text",
              text: `### 🗑️ Deleted Task Count by User\n\n${lines.join("\n")}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching deleted task counts: ${err.message}`,
            },
          ],
        };
      }
    },
  );

  // 5. Update Task Status Tool
  server.registerTool(
    "update_task_status",
    {
      title: "Update Task Status",
      description:
        "Update the status of a task owned by the authenticated user",
      inputSchema: {
        id: z.string().describe("Task UUID"),
        status: z
          .enum(["PENDING", "IN_PROGRESS", "COMPLETED"])
          .describe("New status"),
      },
    },
    async ({ id, status }) => {
      try {
        const updated = await updateTaskStatus(id, status, currentUserId);
        if (!updated) {
          return {
            content: [
              { type: "text", text: "Task not found or access denied." },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `Task status updated:\n${JSON.stringify(updated, null, 2)}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Error updating task: ${err.message}` },
          ],
        };
      }
    },
  );

  // 6. Delete Task Tool
  server.registerTool(
    "delete_task",
    {
      title: "Delete Task",
      description: "Delete a task owned by the authenticated user",
      inputSchema: {
        id: z.string().describe("Task UUID"),
      },
    },
    async ({ id }) => {
      try {
        const success = await deleteTask(id, currentUserId);
        if (!success) {
          return {
            content: [
              { type: "text", text: "Task not found or access denied." },
            ],
          };
        }
        return {
          content: [{ type: "text", text: `Task ${id} deleted successfully.` }],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Error deleting task: ${err.message}` },
          ],
        };
      }
    },
  );
}
