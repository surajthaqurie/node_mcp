import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAllUsers, getUserById, createUser } from "./users.service.js";
import { AuthUser } from "../auth/auth.dto.js";

/**
 * Helper to format user list into a Markdown Table response.
 */
function formatUsersTable(data: any[], pagination: any): string {
  if (data.length === 0) return "No users found.";

  const header = `### 👥 Users List (Page ${pagination.page} of ${pagination.totalPages} | Total: ${pagination.total})\n\n`;
  const tableHeader = `| ID | Name | Email | Role | Created At |\n| :--- | :--- | :--- | :--- | :--- |\n`;
  const tableRows = data
    .map(
      (u) =>
        `| \`${u.id}\` | **${u.name}** | \`${u.email}\` | \`${u.role || "user"}\` | ${new Date(u.created_at || u.createdAt).toLocaleDateString()} |`
    )
    .join("\n");

  return header + tableHeader + tableRows;
}

/**
 * Registers User MCP tools on the McpServer instance.
 */
export function registerUserTools(server: McpServer, user?: AuthUser) {
  // 1. Add User Tool
  server.registerTool(
    "add_user",
    {
      title: "Add User",
      description: "Add / Create a new user in the database",
      inputSchema: {
        name: z.string().min(1, "Name is required").describe("User's full name"),
        email: z.string().email("Invalid email format").describe("User's email address"),
        role: z.string().optional().describe("User role (e.g. 'user', 'admin')"),
      },
    },
    async ({ name, email, role }) => {
      if (!user || user.role === "guest") {
        return {
          content: [{ type: "text", text: "Unauthorized: You must be logged in to create user records. Please authenticate first." }],
        };
      }

      try {
        const newUser = await createUser({ name, email, role });
        return {
          content: [
            {
              type: "text",
              text: `Successfully created user:\n${JSON.stringify(newUser, null, 2)}`,
            },
          ],
        };
      } catch (err: any) {
        let errorMessage = `Database error: ${err.message}`;
        if (err.code === "23505") {
          errorMessage = `Error: A user with email '${email}' already exists.`;
        }
        return {
          content: [{ type: "text", text: errorMessage }],
        };
      }
    }
  );

  // 2. Get User By ID Tool (Requires Authentication)
  server.registerTool(
    "get_user",
    {
      title: "Get user",
      description: "Fetch a user by id (Requires authentication)",
      inputSchema: { id: z.string().describe("User UUID") },
    },
    async ({ id }) => {
      if (!user || user.role === "guest") {
        return {
          content: [{ type: "text", text: "Unauthorized: You must be logged in to view user records. Please authenticate first." }],
        };
      }

      try {
        const userRecord = await getUserById(id);
        if (!userRecord) {
          return { content: [{ type: "text", text: "User not found" }] };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(userRecord, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Database error: ${err.message}` }],
        };
      }
    }
  );

  // 3. Get All Users Tool (Paginated & Markdown Table Response)
  server.registerTool(
    "get_all_users",
    {
      title: "Get all users",
      description: "Fetch paginated users table from the database (Requires authentication)",
      inputSchema: {
        page: z.number().optional().describe("Page number (default: 1)"),
        limit: z.number().optional().describe("Items per page (default: 10)"),
      },
    },
    async ({ page = 1, limit = 10 }) => {
      if (!user || user.role === "guest") {
        return {
          content: [{ type: "text", text: "Unauthorized: You must be logged in to view user records. Please authenticate first." }],
        };
      }

      try {
        const result = await getAllUsers(page, limit);
        const markdownTable = formatUsersTable(result.data, result.pagination);
        return {
          content: [{ type: "text", text: markdownTable }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Database error: ${err.message}` }],
        };
      }
    }
  );
}
