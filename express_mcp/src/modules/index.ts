import { Router } from "express";
import { authRouter } from "./auth/auth.routes.js";
import { tasksRouter } from "./tasks/tasks.routes.js";
import { usersRouter } from "./users/users.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/tasks", tasksRouter);
apiRouter.use("/users", usersRouter);
