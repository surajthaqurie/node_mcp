/**
 * @file users.routes.ts
 * @description Express router declaring HTTP REST endpoints for User management (`/api/users`).
 * 
 * WHY THIS FILE EXISTS:
 * Binds REST routes (`GET /`, `GET /:id`, `POST /`) to corresponding controller functions.
 */

import { Router } from "express";
import { getAllUsersController, getUserByIdController, createUserController } from "./users.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";

export const usersRouter = Router();

/**
 * @route GET /api/users
 * @description Retrieve paginated user records with optional search filter params.
 */
usersRouter.get("/", getAllUsersController);

/**
 * @route GET /api/users/:id
 * @description Retrieve a specific user record by UUID parameter.
 */
usersRouter.get("/:id", getUserByIdController);

/**
 * @route POST /api/users
 * @description Create a new user record in the database (Protected by authMiddleware).
 */
usersRouter.post("/", authMiddleware, createUserController);
