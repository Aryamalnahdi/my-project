import { z } from "zod";
import { usernameSchema } from "./validation";

export const employeeLoginSchema = z.object({
  username: usernameSchema,
  password: z.string().regex(/^[0-9]{4}$/, "Enter exactly 4 numeric digits."),
}).strict();
export const employeeSchema = z.object({ name: z.string().trim().max(100).optional() }).strict();
export const ticketSchema = z.object({
  title: z.string().trim().min(1, "Enter a problem title.").max(160),
  description: z.string().trim().min(1, "Describe the problem.").max(10000),
}).strict();
export const ticketNoteSchema = z.object({
  ticket_id: z.uuid(),
  note: z.string().trim().min(1, "Enter a note.").max(5000),
}).strict();
