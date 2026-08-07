import { Router } from "express";
import {
  createTaskController,
  getTasksController,
  updateTaskStatusController,
  deleteTaskController,
} from "./tasks.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";

export const tasksRouter = Router();

tasksRouter.use(authMiddleware);

tasksRouter.post("/", createTaskController);
tasksRouter.get("/", getTasksController);
tasksRouter.patch("/:id", updateTaskStatusController);
tasksRouter.delete("/:id", deleteTaskController);
