/**
 * @file users.tools.ts
 * @description User management tool handlers registered on the Model Context Protocol (MCP) server.
 * 
 * WHY THIS FILE EXISTS:
 * Registers 3 MCP database tools for AI assistants:
 * 1. `add_user`: Creates a new user in the database (requires authentication).
 * 2. `get_user`: Retrieves user by UUID (requires authentication).
 * 3. `get_all_users`: Fetches paginated user records formatted into a clean Markdown table with search capabilities.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAllUsers, getUserById, createUser } from "./users.service.js";
import { AuthUser } from "../auth/auth.dto.js";

/**
 * Formats user list array into a clean Markdown table with pagination metadata.
 * 
 * @param data Array of user objects.
 * @param pagination Object containing page, totalPages, total.
 * @param query Optional search query string.
 * @param searchBy Scope filter.
 * @returns Formatted Markdown string.
 */
function formatUsersTable(
  data: any[],
  pagination: any,
  query?: string,
  searchBy?: string,
): string {
  if (data.length === 0) return "No users found.";

  const searchText = query
    ? ` | Search: ${query}${searchBy ? ` (${searchBy})` : ""}`
    : "";
  const header = `### 👥 Users List (Page ${pagination.page} of ${pagination.totalPages} | Total: ${pagination.total}${searchText})\n\n`;
  const tableHeader = `| ID | Name | Email | Role | Created At |\n| :--- | :--- | :--- | :--- | :--- |\n`;
  const tableRows = data
    .map(
      (u) =>
        `| \`${u.id}\` | **${u.name}** | \`${u.email}\` | \`${u.role || "user"}\` | ${new Date(u.created_at || u.createdAt).toLocaleDateString()} |`,
    )
    .join("\n");

  return header + tableHeader + tableRows;
}

/**
 * Registers user-related MCP tools onto the target McpServer instance.
 * 
 * @param server McpServer instance.
 * @param user Optional authenticated user context.
 */
export function registerUserTools(server: McpServer, user?: AuthUser) {
  // 1. Add User Tool
  server.registerTool(
    "add_user",
    {
      title: "Add User",
      description: "Add / Create a new user in the database",
      inputSchema: {
        name: z
          .string()
          .min(1, "Name is required")
          .describe("User's full name"),
        email: z
          .string()
          .email("Invalid email format")
          .describe("User's email address"),
        role: z
          .string()
          .optional()
          .describe("User role (e.g. 'user', 'admin')"),
      },
    },
    async ({ name, email, role }) => {
      if (!user || user.role === "guest") {
        return {
          content: [
            {
              type: "text",
              text: "Unauthorized: You must be logged in to create user records. Please authenticate first.",
            },
          ],
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
    },
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
          content: [
            {
              type: "text",
              text: "Unauthorized: You must be logged in to view user records. Please authenticate first.",
            },
          ],
        };
      }

      try {
        const userRecord = await getUserById(id);
        if (!userRecord) {
          return { content: [{ type: "text", text: "User not found" }] };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(userRecord, null, 2) },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Database error: ${err.message}` }],
        };
      }
    },
  );

  // 3. Get All Users Tool (Paginated & Markdown Table Response)
  server.registerTool(
    "get_all_users",
    {
      title: "Get all users",
      description:
        "Fetch paginated users table from the database (Requires authentication)",
      inputSchema: {
        page: z.number().optional().describe("Page number (default: 1)"),
        limit: z.number().optional().describe("Items per page (default: 10)"),
        query: z
          .string()
          .optional()
          .describe("Filter users by name or email text"),
        searchBy: z
          .enum(["name", "email", "all"])
          .optional()
          .describe("Search scope: name, email, or both"),
      },
    },
    async ({ page = 1, limit = 10, query, searchBy = "all" }) => {
      if (!user || user.role === "guest") {
        return {
          content: [
            {
              type: "text",
              text: "Unauthorized: You must be logged in to view user records. Please authenticate first.",
            },
          ],
        };
      }

      try {
        const result = await getAllUsers(page, limit, query, searchBy);
        const paginationHint =
          result.pagination.page < result.pagination.totalPages
            ? `\n\nType "next" to view page ${result.pagination.page + 1}.`
            : "";
        const markdownTable =
          formatUsersTable(result.data, result.pagination, query, searchBy) +
          paginationHint;
        return {
          content: [{ type: "text", text: markdownTable }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Database error: ${err.message}` }],
        };
      }
    },
  );
}
