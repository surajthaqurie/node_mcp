/**
 * @file users.controller.ts
 * @description HTTP controllers for User management endpoints (`/api/users`).
 * 
 * WHY THIS FILE EXISTS:
 * Handles incoming REST requests for user endpoints (`GET /api/users`, `GET /api/users/:id`, `POST /api/users`),
 * performs request validation, invokes user service functions, and formats HTTP responses.
 */

import { Request, Response } from "express";
import { CreateUserSchema, GetUserByIdSchema } from "./users.dto.js";
import { getAllUsers, getUserById, createUser } from "./users.service.js";

/**
 * Controller: Retrieves paginated user records from PostgreSQL database (`GET /api/users`).
 * 
 * QUERY PARAMS: `page`, `limit`, `query`, `searchBy`
 */
export async function getAllUsersController(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const query =
      typeof req.query.query === "string" ? req.query.query : undefined;
    const searchBy =
      typeof req.query.searchBy === "string" ? req.query.searchBy : undefined;
    const result = await getAllUsers(page, limit, query, searchBy);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Controller: Fetches a single user profile by UUID param (`GET /api/users/:id`).
 * 
 * PATH PARAM: `id` (User UUID)
 */
export async function getUserByIdController(req: Request, res: Response) {
  try {
    const rawId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const paramValidation = GetUserByIdSchema.safeParse({ id: rawId });
    if (!paramValidation.success) {
      return res
        .status(400)
        .json({ error: paramValidation.error.issues[0].message });
    }

    const user = await getUserById(paramValidation.data.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Controller: Creates a new user record in PostgreSQL (`POST /api/users`).
 * 
 * BODY: `{ name, email, role? }`
 */
export async function createUserController(req: Request, res: Response) {
  try {
    const validation = CreateUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json({ error: validation.error.issues[0].message });
    }

    const user = await createUser(validation.data);
    return res.status(201).json(user);
  } catch (err: any) {
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "User with this email already exists" });
    }
    return res.status(500).json({ error: err.message });
  }
}
