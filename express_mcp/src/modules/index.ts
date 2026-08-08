/**
 * @file index.ts
 * @description Central modular REST API router aggregator.
 * 
 * WHY THIS FILE EXISTS:
 * Combines modular domain routers into a single `apiRouter` instance mounted at `/api` in `server.ts`:
 * - `/api/auth`  -> Authentication endpoints (`authRouter`)
 * - `/api/tasks` -> Task management endpoints (`tasksRouter`)
 * - `/api/users` -> User management endpoints (`usersRouter`)
 */

import { Router } from "express";
import { authRouter } from "./auth/auth.routes.js";
import { tasksRouter } from "./tasks/tasks.routes.js";
import { usersRouter } from "./users/users.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/tasks", tasksRouter);
apiRouter.use("/users", usersRouter);
