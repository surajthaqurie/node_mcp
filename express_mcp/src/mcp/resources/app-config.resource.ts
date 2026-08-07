import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerAppConfigResource(server: McpServer) {
  server.registerResource(
    "config",
    new ResourceTemplate("config://app", { list: undefined }),
    {
      title: "App Config",
      description: "Application configuration settings",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify({
            appName: "Express MCP Service",
            version: "1.0.0",
            environment: process.env.NODE_ENV || "development",
          }),
        },
      ],
    }),
  );
}
