/**
 * @file tasks.routes.ts
 * @description Express router declaring HTTP REST endpoints for Task management (`/api/tasks`).
 * 
 * WHY THIS FILE EXISTS:
 * Binds REST routes (`GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`) to controllers under mandatory `authMiddleware` protection.
 */

import { Router } from "express";
import {
  createTaskController,
  getTasksController,
  updateTaskStatusController,
  deleteTaskController,
} from "./tasks.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";

export const tasksRouter = Router();

// Enforce strict authentication middleware across all task routes
tasksRouter.use(authMiddleware);

/**
 * @route POST /api/tasks
 * @description Create a new task owned by the authenticated user.
 */
tasksRouter.post("/", createTaskController);

/**
 * @route GET /api/tasks
 * @description Retrieve paginated tasks owned by the authenticated user with optional status filter.
 */
tasksRouter.get("/", getTasksController);

/**
 * @route PATCH /api/tasks/:id
 * @description Update the status of a specific task owned by the authenticated user.
 */
tasksRouter.patch("/:id", updateTaskStatusController);

/**
 * @route DELETE /api/tasks/:id
 * @description Soft delete a specific task owned by the authenticated user.
 */
tasksRouter.delete("/:id", deleteTaskController);
