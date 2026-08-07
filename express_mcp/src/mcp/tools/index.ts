import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMathTool } from "./math.tool.js";
import { registerUserTools } from "../../modules/users/users.tools.js";
import { registerTaskTools } from "../../modules/tasks/tasks.tools.js";
import { AuthUser } from "../../modules/auth/auth.dto.js";

export function registerTools(server: McpServer, user?: AuthUser) {
  registerMathTool(server);
  registerUserTools(server, user);
  registerTaskTools(server, user);
}
