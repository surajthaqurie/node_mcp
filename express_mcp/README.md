# Express MCP (Model Context Protocol) & Chat Client

An Express-based Model Context Protocol (MCP) server integrated with an AI Chat backend and a Vite-powered web client interface.

---

## 📋 Table of Contents

- [Prerequisites](#-prerequisites)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Environment Configuration](#-environment-configuration)
- [Running the Application](#-running-the-application)
  - [Run Both Server and Client (Recommended)](#1-run-both-server-and-client-recommended)
  - [Run Server Only](#2-run-server-only)
  - [Run Client Only](#3-run-client-only)
- [API Endpoints](#-api-endpoints)
- [Client Build & Preview](#-client-build--preview)

---

## 🛠 Prerequisites

Before starting, ensure you have the following installed on your machine:

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: (Required if using database tools/resources)
- **Ollama** or **Google Gemini API Key**: (Required for LLM response processing)

---

## 📁 Project Structure

```text
express_mcp/
├── client/                      # Vite web client application
├── src/                         # Express & MCP Server codebase
│   ├── modules/                 # NestJS-style Functional Feature Modules
│   │   ├── auth/                # Auth Feature Module
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── auth.dto.ts
│   │   ├── tasks/               # Tasks Feature Module
│   │   │   ├── tasks.controller.ts
│   │   │   ├── tasks.service.ts
│   │   │   ├── tasks.routes.ts
│   │   │   ├── tasks.tools.ts
│   │   │   └── tasks.dto.ts
│   │   ├── users/               # Users Feature Module
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.routes.ts
│   │   │   ├── users.tools.ts
│   │   │   └── users.dto.ts
│   │   └── index.ts             # Master API Router
│   ├── middleware/              # Functional Middlewares
│   │   ├── auth.middleware.ts
│   │   └── error-handler.middleware.ts
│   ├── migrations/              # SQL Database Migration files & Runner
│   │   ├── 001_create_users_table.sql
│   │   ├── 002_create_tasks_table.sql
│   │   └── runner.ts
│   ├── tools/                   # MCP Tools Registry
│   ├── resources/               # MCP Resources Registry
│   ├── prompts/                 # MCP Prompts Registry
│   ├── db.ts                    # Database pool connection
│   └── server.ts                # Express & MCP entrypoint
├── .env                         # Environment configuration
└── package.json                 # Server scripts & dependencies
```

## 🚀 Running Server & Client (All-in-One)

Launch database migrations, Express server, and Vite web client together with a single command:

```bash
# Development: Runs migrations, then launches Server & Client concurrently
npm run dev:all

# Production: Builds project, runs migrations, and starts production server
npm run start:all

# MCP Stdio Mode: Runs standalone MCP transport over stdin/stdout
npm run mcp:stdio
```

---

## 🔌 MCP Stdio Configuration (Claude Desktop / Cursor / Inspector)

To connect this MCP server to **Claude Desktop**, **Cursor**, or an **MCP Client Inspector**, add the following configuration to your `claude_desktop_config.json` or MCP config file:

```json
{
  "mcpServers": {
    "express_mcp": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "/home/suraj/Documents/playground/express_mcp/src/mcp/stdio.ts"
      ]
    }
  }
}
```
*(Note: `dotenv` automatically loads environment variables from your local `.env` file upon startup).*

### 📍 Configuration File Locations:
- **Claude Desktop (Linux)**: `~/.config/Claude/claude_desktop_config.json`
- **Claude Desktop (macOS)**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Claude Desktop (Windows)**: `%APPDATA%\Claude\claude_desktop_config.json`

---

## 🗄 Database Migrations

Run database migrations to check database existence, auto-create missing database, and initialize/update PostgreSQL tables:

```bash
# Development mode migration
npm run db:migrate

# Production mode migration (compiled code)
npm run db:migrate:prod
```

---

## 📦 Installation

1. **Clone the repository** (if not already local):
   ```bash
   git clone <repository-url>
   cd express_mcp
   ```

2. **Install root (Server) dependencies**:
   ```bash
   npm install
   ```

3. **Install Client dependencies**:
   ```bash
   cd client
   npm install
   cd ..
   ```

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory (or update the existing one):

```env
# Server Configuration
PORT=3000

# Database Configuration (PostgreSQL)
DATABASE_URL=postgres://postgres:root@localhost:5432/pos_dev

# Google Gemini API Key (Optional if using Gemini)
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

# Ollama Configuration (Optional if using local Ollama)
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:0.5b
```

---

## 🚀 Running the Application

### 1. Run Both Server and Client (Recommended)

Run both the Express server and Vite client concurrently using a single command from the root directory:

```bash
npm run dev
```

- **Express Server**: `http://localhost:3000`
- **Vite Client**: `http://localhost:5173` (or as logged by Vite)

---

### 2. Run Server Only

To start only the backend Express MCP server in watch mode:

```bash
npm run dev:server
```

---

### 3. Run Client Only

To start only the frontend Vite client:

From the root directory:
```bash
npm run dev:client
```

Or from inside the `client` directory:
```bash
cd client
npm run dev
```

---

## 🔗 API Endpoints

| Endpoint | Method | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/token` | `POST` | No | Generates JWT authentication token for testing/user sessions |
| `/api/tasks` | `POST` | Yes | Create a new task for authenticated user |
| `/api/tasks` | `GET` | Yes | Get tasks owned by authenticated user (optional `?status=PENDING`) |
| `/api/tasks/:id` | `PATCH` | Yes | Update task status (`PENDING`, `IN_PROGRESS`, `COMPLETED`) |
| `/api/tasks/:id` | `DELETE` | Yes | Delete task owned by authenticated user |
| `/mcp` | `POST` | Yes | MCP JSON-RPC endpoint for tools, resources, and prompts |
| `/api/chat` | `POST` | Yes | Chat completion endpoint powered by LLM and MCP tools |
| `/health` | `GET` | No | Server health check endpoint |
| `/docs` | `GET` | No | Swagger UI documentation |

---

## 🛠 Registered MCP Tools

| Tool Name | Description | Example Chat Input |
| :--- | :--- | :--- |
| `create_task` | Creates a task for authenticated user | `"Create a task to write unit tests"` |
| `list_tasks` | Lists tasks for authenticated user | `"Show my pending tasks"` |
| `update_task_status` | Updates status of a task | `"Mark task 123e4567... as COMPLETED"` |
| `delete_task` | Deletes a task by ID | `"Delete task 123e4567..."` |
| `add_user` | Creates a new user in database | `"Create a user named Alice with email alice@example.com"` |
| `get_user` | Fetches user details by UUID | `"Get user details for ID 123e4567-e89b..."` |
| `get_all_users` | Lists all users from database | `"List all users"` |
| `add` | Performs addition of two numbers | `"What is 25 plus 17?"` or `/add 25 17` |



---

## 🏗 Client Build & Preview

To build the client application for production:

```bash
cd client
npm run build
```

To preview the production build locally:

```bash
cd client
npm run preview
```
