import { z } from "zod";

export const usernameSchema = z.string().trim().min(1, "Enter a username.").max(80)
  .regex(/^[\p{L}\p{N} ._-]+$/u, "Use letters, numbers, spaces, dots, underscores, or hyphens.");
export const passwordSchema = z.string().min(12, "Use at least 12 characters.").max(128);
export const loginSchema = z.object({ username: usernameSchema, password: z.string().min(1).max(128) }).strict();
export const userSchema = z.object({ name: z.string().trim().min(1).max(100), username: usernameSchema, password: passwordSchema }).strict();
export const statusSchema = z.enum(["Approved", "Not Approved"]);
export const taskSchema = z.object({
  task_text: z.string().trim().min(1, "Enter the task.").max(2000),
  assigned_user_id: z.uuid(),
  head_id: z.number().int().min(1).max(3),
  status: statusSchema,
}).strict();
export const ownTaskSchema = z.object({ task_text: z.string().trim().min(1).max(2000), status: statusSchema }).strict();
export const statusChangeSchema = z.object({ task_id: z.uuid(), status: statusSchema }).strict();
