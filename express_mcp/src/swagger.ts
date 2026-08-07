import { Express, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";

export function setupSwagger(app: Express, server: McpServer) {
  const openApiDoc = {
    openapi: "3.0.0",
    info: {
      title: "Express MCP REST & Model Context Protocol API",
      version: "1.0.0",
      description: "Interactive Swagger API documentation for Express REST endpoints, Auth, Tasks, Users, and MCP Tools",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT Bearer token",
        },
      },
    },
    paths: {
      // ---------------------------------------------------------------------
      // 0. AI Chat Routes (Global Public & Authenticated)
      // ---------------------------------------------------------------------
      "/api/chat": {
        post: {
          summary: "Global AI Chat (Public / Optional Auth)",
          tags: ["AI Chat API"],
          description: "Global chat router connected to MCP tools. Accepts requests with or without Bearer JWT token.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message"],
                  properties: {
                    message: { type: "string", example: "List all users" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "AI response with executed MCP tool results" },
          },
        },
      },
      "/api/chat/authenticated": {
        post: {
          summary: "Authenticated AI Chat (Requires JWT Bearer Token)",
          tags: ["AI Chat API"],
          security: [{ bearerAuth: [] }],
          description: "Authenticated chat router requiring valid JWT token to execute user-scoped MCP tools.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message"],
                  properties: {
                    message: { type: "string", example: "List my tasks" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "AI response with authenticated MCP tool results" },
            "401": { description: "Unauthorized" },
          },
        },
      },

      // ---------------------------------------------------------------------
      // 1. Auth REST Routes
      // ---------------------------------------------------------------------
      "/api/auth/login": {
        post: {
          summary: "User Login",
          tags: ["Auth API"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", example: "admin@example.com" },
                    password: { type: "string", example: "password123" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Login successful",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      token: { type: "string" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validation error" },
          },
        },
      },
      "/api/auth/token": {
        post: {
          summary: "Generate Dev JWT Token",
          tags: ["Auth API"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["userId", "email"],
                  properties: {
                    userId: { type: "string", example: "user-123" },
                    email: { type: "string", example: "user@example.com" },
                    role: { type: "string", example: "admin" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Dev token generated successfully" },
          },
        },
      },

      // ---------------------------------------------------------------------
      // 2. Tasks REST Routes
      // ---------------------------------------------------------------------
      "/api/tasks": {
        get: {
          summary: "Get All Tasks",
          tags: ["Tasks API"],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "status",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["PENDING", "IN_PROGRESS", "COMPLETED"] },
              description: "Filter tasks by status",
            },
          ],
          responses: {
            "200": { description: "List of user tasks" },
            "401": { description: "Unauthorized" },
          },
        },
        post: {
          summary: "Create Task",
          tags: ["Tasks API"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title"],
                  properties: {
                    title: { type: "string", example: "Design API Architecture" },
                    description: { type: "string", example: "Create OpenAPI schemas" },
                    status: { type: "string", enum: ["PENDING", "IN_PROGRESS", "COMPLETED"], example: "PENDING" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Task created successfully" },
            "400": { description: "Validation error" },
          },
        },
      },
      "/api/tasks/{id}": {
        patch: {
          summary: "Update Task Status",
          tags: ["Tasks API"],
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status"],
                  properties: {
                    status: { type: "string", enum: ["PENDING", "IN_PROGRESS", "COMPLETED"], example: "COMPLETED" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Task status updated" },
            "404": { description: "Task not found" },
          },
        },
        delete: {
          summary: "Delete Task",
          tags: ["Tasks API"],
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Task deleted successfully" },
            "404": { description: "Task not found" },
          },
        },
      },

      // ---------------------------------------------------------------------
      // 3. Users REST Routes
      // ---------------------------------------------------------------------
      "/api/users": {
        get: {
          summary: "Get All Users",
          tags: ["Users API"],
          responses: {
            "200": { description: "List of all users" },
          },
        },
        post: {
          summary: "Create User",
          tags: ["Users API"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "email"],
                  properties: {
                    name: { type: "string", example: "Jane Doe" },
                    email: { type: "string", example: "jane@example.com" },
                    role: { type: "string", example: "user" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "User created" },
            "409": { description: "User already exists" },
          },
        },
      },
      "/api/users/{id}": {
        get: {
          summary: "Get User By ID",
          tags: ["Users API"],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "User details" },
            "404": { description: "User not found" },
          },
        },
      },
    } as any,
  };

  // -------------------------------------------------------------------------
  // Dynamic MCP Tools, Resources, Prompts Documentation & Express Wrappers
  // -------------------------------------------------------------------------
  const registeredTools = (server as any)._registeredTools as Record<string, any>;
  const registeredResources = (server as any)._registeredResources as Record<string, any>;
  const registeredPrompts = (server as any)._registeredPrompts as Record<string, any>;

  // 1. MCP Tools
  for (const [name, tool] of Object.entries(registeredTools)) {
    let jsonSchema = {};
    if (tool.inputSchema) {
      jsonSchema = toJsonSchemaCompat(tool.inputSchema);
    }

    openApiDoc.paths[`/api/tools/${name}`] = {
      post: {
        summary: tool.description || `Execute MCP tool '${name}'`,
        tags: ["MCP Tools"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: jsonSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Successful response",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    };

    app.post(`/api/tools/${name}`, async (req: Request, res: Response) => {
      try {
        const result = await tool.handler(req.body, {});
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  // 2. MCP Resources
  for (const resource of Object.values(registeredResources)) {
    const name = resource.name;
    const uriTemplate = resource.uriTemplate;

    openApiDoc.paths[`/api/resources/${name}`] = {
      post: {
        summary: resource.title || `Read MCP resource '${name}'`,
        tags: ["MCP Resources"],
        description: `URI Template: ${uriTemplate?.href || uriTemplate}`,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["uri"],
                properties: {
                  uri: {
                    type: "string",
                    description: "The fully resolved URI to read",
                    example: uriTemplate?.href || uriTemplate,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Successful response",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    };

    app.post(`/api/resources/${name}`, async (req: Request, res: Response) => {
      try {
        const { uri } = req.body;
        if (!uri) return res.status(400).json({ error: "Missing uri in request body" });
        const urlObj = new URL(uri);
        const result = await resource.readCallback(urlObj);
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  // 3. MCP Prompts
  for (const [name, prompt] of Object.entries(registeredPrompts)) {
    let jsonSchema = {};
    if (prompt.argsSchema) {
      jsonSchema = toJsonSchemaCompat(prompt.argsSchema);
    }

    openApiDoc.paths[`/api/prompts/${name}`] = {
      post: {
        summary: prompt.title || `Execute MCP prompt '${name}'`,
        tags: ["MCP Prompts"],
        description: prompt.description || "",
        requestBody: {
          required: Object.keys(jsonSchema).length > 0,
          content: {
            "application/json": {
              schema: jsonSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Successful response",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    };

    app.post(`/api/prompts/${name}`, async (req: Request, res: Response) => {
      try {
        const result = await prompt.callback(req.body || {});
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  // Mount Swagger UI at /api-docs
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDoc));
}
