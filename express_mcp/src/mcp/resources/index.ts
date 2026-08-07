import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppConfigResource } from "./app-config.resource.js";

export function registerResources(server: McpServer) {
  registerAppConfigResource(server);
}
