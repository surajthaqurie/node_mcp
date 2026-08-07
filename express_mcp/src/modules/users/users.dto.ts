import { z } from "zod";

export const CreateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.string().optional(),
});

export const GetUserByIdSchema = z.object({
  id: z.string().min(1, "User ID is required"),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type GetUserByIdDto = z.infer<typeof GetUserByIdSchema>;

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
