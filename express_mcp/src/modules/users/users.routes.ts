import { Router } from "express";
import { getAllUsersController, getUserByIdController, createUserController } from "./users.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";

export const usersRouter = Router();

usersRouter.get("/", getAllUsersController);
usersRouter.get("/:id", getUserByIdController);
usersRouter.post("/", authMiddleware, createUserController);
