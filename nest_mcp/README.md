# 🚀 Nest MCP

A production-ready **NestJS REST API** with JWT authentication, Role-Based Access Control (RBAC), and granular permission management.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Framework | [NestJS](https://nestjs.com/) v11 |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | TypeORM |
| Auth | JWT + Passport.js |
| Validation | class-validator / class-transformer |
| Docs | Swagger / OpenAPI |
| Password | bcryptjs |

---

## ✨ Features

- ✅ JWT Authentication (register / login / profile)
- ✅ Role-Based Access Control — `admin`, `manager`, `user`
- ✅ Granular permission system (`resource:action` format)
- ✅ Dual guard strategy — `RolesGuard` + `PermissionsGuard`
- ✅ Full CRUD for **Users** and **Tasks**
- ✅ Task ownership enforcement (users see only their own tasks)
- ✅ TypeORM migrations (no `synchronize` in production)
- ✅ DB creation script — auto-creates database if not found
- ✅ Database seeder — 20 users with realistic permission sets
- ✅ Swagger UI at `/api/docs`

---

## 📁 Project Structure

```
src/
├── app.module.ts                   # Root module
├── main.ts                         # Bootstrap (Swagger, validation, global prefix)
│
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts   # @CurrentUser() param decorator
│   │   ├── permissions.decorator.ts    # @RequirePermissions(...)
│   │   └── roles.decorator.ts          # @Roles(...)
│   ├── enums/
│   │   ├── permission.enum.ts          # user:*, task:*, permission:manage
│   │   ├── role.enum.ts                # admin | manager | user
│   │   └── task-status.enum.ts        # TaskStatus, TaskPriority
│   └── guards/
│       ├── jwt-auth.guard.ts           # Passport JWT guard
│       ├── permissions.guard.ts        # Granular permission check
│       └── roles.guard.ts              # Role-level check
│
├── database/
│   ├── data-source.ts              # TypeORM DataSource (used by migration CLI)
│   ├── create-database.ts          # Script: create DB if not exists
│   ├── seed.ts                     # Script: seed 20 users with permissions
│   └── migrations/                 # Auto-generated migration files
│
└── modules/
    ├── auth/                       # Register, Login, /me
    ├── users/                      # User CRUD (admin/manager)
    ├── tasks/                      # Task CRUD (permission-gated)
    └── permissions/                # Assign / revoke / list permissions
```

---

## ⚙️ Getting Started

### 1. Clone & install

```bash
git clone <repo-url>
cd nest_mcp
npm install
```

### 2. Environment

```bash
cp .env.sample .env
```

Edit `.env`:

```env
PORT=3000
DATABASE_URL=postgres://postgres:root@localhost:5432/nest_mcp
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d
```

### 3. One-command setup (create DB + migrate + seed)

```bash
npm run db:setup
```

This runs in sequence:
1. **`db:create`** — creates the PostgreSQL database if it doesn't exist
2. **`migration:run`** — applies all pending migrations
3. **`db:seed`** — seeds 20 users with permissions

### 4. Start the server

```bash
# Development (watch mode)
npm run dev

# Production
npm run build && npm run start:prod
```

Server: `http://localhost:3000/api/v1`  
Swagger: `http://localhost:3000/api/docs`

---

## 📜 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start in watch mode |
| `npm run build` | Compile TypeScript |
| `npm run start:prod` | Run compiled production build |
| `npm run format` | Prettier format all files |
| `npm run lint` | ESLint fix all files |
| **Database** | |
| `npm run db:create` | Create the database if it doesn't exist |
| `npm run db:seed` | Seed 20 users with permissions |
| `npm run db:setup` | Full setup: create + migrate + seed |
| **Migrations** | |
| `npm run migration:generate -- src/database/migrations/Name` | Generate migration from entity changes |
| `npm run migration:run` | Apply all pending migrations |
| `npm run migration:revert` | Undo last applied migration |
| `npm run migration:show` | Show migration status (`[X]` = applied) |

---

## 🔐 Authentication

### Register
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "password": "SecurePass123!"
}
```

### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@nest-mcp.com",
  "password": "Admin@12345"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGci...",
  "user": { "id": "...", "email": "...", "role": "admin", "permissions": [...] }
}
```

Use the token in all protected requests:
```http
Authorization: Bearer <accessToken>
```

---

## 🛣️ API Routes

### Auth — `/api/v1/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | ❌ | Register a new user |
| `POST` | `/login` | ❌ | Login, receive JWT |
| `GET` | `/me` | ✅ | Get current user profile |

### Users — `/api/v1/users`

| Method | Path | Role | Permission | Description |
|---|---|---|---|---|
| `GET` | `/profile` | Any | — | My profile |
| `GET` | `/` | admin, manager | `user:read` | List all users |
| `GET` | `/:id` | admin, manager | `user:read` | Get user by ID |
| `POST` | `/` | admin | `user:create` | Create user |
| `PATCH` | `/:id` | admin | `user:update` | Update user |
| `DELETE` | `/:id` | admin | `user:delete` | Delete user |

### Tasks — `/api/v1/tasks`

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/my-tasks` | — | My tasks (created or assigned) |
| `GET` | `/` | `task:read` | All tasks (role-filtered) |
| `GET` | `/:id` | `task:read` | Get task by ID |
| `POST` | `/` | `task:create` | Create task |
| `PATCH` | `/:id` | `task:update` | Update task |
| `DELETE` | `/:id` | `task:delete` | Delete task |

> **Note:** Admins/Managers see all tasks. Regular users only see tasks they created or are assigned to.

### Permissions — `/api/v1/permissions`

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/` | admin | List all available permissions |
| `GET` | `/user/:id` | admin, manager | Get a user's permissions |
| `POST` | `/assign` | admin | Assign permissions to user |
| `DELETE` | `/revoke/:id` | admin | Revoke permissions from user |

---

## 👥 Roles & Permissions

### Roles (hierarchy)

| Role | Description |
|---|---|
| `admin` | Full access — all routes and operations |
| `manager` | Can read users, manage tasks, assign permissions |
| `user` | Limited to their own tasks based on assigned permissions |

### Available Permissions

| Permission | Description |
|---|---|
| `user:read` | View users |
| `user:create` | Create users |
| `user:update` | Update users |
| `user:delete` | Delete users |
| `task:read` | View tasks |
| `task:create` | Create tasks |
| `task:update` | Update tasks |
| `task:delete` | Delete tasks |
| `permission:manage` | Assign/revoke permissions |

---

## 🌱 Seeded Users

After running `npm run db:seed`:

| Role | Email | Password | Permissions |
|---|---|---|---|
| admin | `admin@nest-mcp.com` | `Admin@12345` | All (9) |
| manager | `manager1@nest-mcp.com` | `Manager@12345` | 6 |
| manager | `manager2@nest-mcp.com` | `Manager@12345` | 6 |
| manager | `manager3@nest-mcp.com` | `Manager@12345` | 6 |
| user | `user1@nest-mcp.com` | `User@12345` | `task:read` |
| user | `user2@nest-mcp.com` | `User@12345` | `task:read/create` |
| user | `user3@nest-mcp.com` | `User@12345` | `task:read/create/update` |
| user | `user4@nest-mcp.com` | `User@12345` | Full task access |
| user | `user5–16@nest-mcp.com` | `User@12345` | Cycling through tiers 1–4 |

> The seeder is **idempotent** — running it multiple times safely skips already existing users.

---

## 🔄 Migration Workflow

Whenever you change an entity:

```bash
# 1. Generate a new migration
npm run migration:generate -- src/database/migrations/AddNewField

# 2. Apply it
npm run migration:run

# 3. Check status
npm run migration:show
```

To roll back the last migration:
```bash
npm run migration:revert
```

---

## 📄 License

UNLICENSED
