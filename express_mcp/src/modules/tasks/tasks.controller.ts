import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { CreateTaskSchema, UpdateTaskStatusSchema } from "./tasks.dto.js";
import { createTask, getTasks, updateTaskStatus, deleteTask } from "./tasks.service.js";

/**
 * Controller: Creates a new task bound to the authenticated user ID.
 */
export async function createTaskController(req: AuthenticatedRequest, res: Response) {
  try {
    const validation = CreateTaskSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues[0].message });
    }

    const task = await createTask({
      ...validation.data,
      userId: req.user!.userId,
    });

    return res.status(201).json(task);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Controller: Retrieves paginated tasks owned by the authenticated user.
 */
export async function getTasksController(req: AuthenticatedRequest, res: Response) {
  try {
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const result = await getTasks(req.user!.userId, status, page, limit);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Controller: Updates the status of a specific task owned by the authenticated user.
 */
export async function updateTaskStatusController(req: AuthenticatedRequest, res: Response) {
  try {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const validation = UpdateTaskStatusSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues[0].message });
    }

    const updated = await updateTaskStatus(
      taskId,
      validation.data.status,
      req.user!.userId
    );

    if (!updated) {
      return res.status(404).json({ error: "Task not found or access denied" });
    }

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Controller: Deletes a specific task owned by the authenticated user.
 */
export async function deleteTaskController(req: AuthenticatedRequest, res: Response) {
  try {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const success = await deleteTask(taskId, req.user!.userId);

    if (!success) {
      return res.status(404).json({ error: "Task not found or access denied" });
    }

    return res.json({ message: "Task deleted successfully" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
