"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sessionProfile } from "@/lib/auth";
import { authEmail, canonicalUsername } from "@/lib/identity";
import { supabaseServer } from "@/lib/supabase/server";
import { authenticate } from "@/lib/login";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ownTaskSchema, statusChangeSchema, taskSchema, userSchema } from "@/lib/validation";

export type Result = { error?: string; success?: string };
const denied = { error: "You do not have permission to perform this action." };
function refreshTasks() { ["/admin", "/head", "/my-tasks"].forEach((path) => revalidatePath(path)); }

export async function login(input: unknown): Promise<Result> {
  const result = await authenticate(input, "legacy");
  if (result.destination) redirect(result.destination);
  return { error: result.error };
}

export async function logout() {
  const actor = await sessionProfile();
  const destination = actor?.role === "main_admin" ? "/admin/login" : actor?.role === "employee" ? "/employee/login" : "/login";
  const db = await supabaseServer();
  const { error } = await db.auth.signOut({ scope: "local" });
  if (error) throw new Error("Unable to sign out. Please try again.");
  redirect(destination);
}

export async function createUser(input: unknown): Promise<Result> {
  const actor = await sessionProfile();
  if (actor?.role !== "main_admin") return denied;
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "Account creation is not configured. Contact the platform administrator." };
  const db = supabaseAdmin();
  const { name, password } = parsed.data;
  const username = canonicalUsername(parsed.data.username);
  const { data, error } = await db.auth.admin.createUser({ email: authEmail(username), password, email_confirm: true });
  if (error || !data.user) return { error: "Unable to create the account. The username may already be in use." };
  const { error: profileError } = await db.from("profiles").insert({ id: data.user.id, name, username, role: "normal_user" });
  if (profileError) {
    const cleanup = await db.auth.admin.deleteUser(data.user.id);
    if (cleanup.error) console.error("Failed to roll back incomplete account", data.user.id);
    return { error: "The account could not be created. Please try again." };
  }
  revalidatePath("/admin");
  return { success: "User created. Give the login credentials to the user securely." };
}

export async function createTask(input: unknown): Promise<Result> {
  const actor = await sessionProfile();
  if (!actor || !["main_admin", "normal_user"].includes(actor.role)) return denied;
  const db = await supabaseServer();
  if (actor.role === "main_admin") {
    const parsed = taskSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const t = parsed.data;
    const { error } = await db.rpc("create_admin_task", { p_text: t.task_text, p_assignee: t.assigned_user_id, p_head: t.head_id, p_status: t.status });
    if (error) return { error: "Unable to create the task. Check the assignee and Head account setup." };
  } else {
    const parsed = ownTaskSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { error } = await db.rpc("create_own_task", { p_text: parsed.data.task_text, p_status: parsed.data.status });
    if (error) return { error: "Unable to add the task. Your administrator may need to finish Head and notification setup." };
  }
  refreshTasks();
  return { success: "Task added." };
}

export async function updateStatus(input: unknown): Promise<Result> {
  const actor = await sessionProfile();
  if (!actor || !["main_admin", "normal_user"].includes(actor.role)) return denied;
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return { error: "Select Approved or Not Approved." };
  const db = await supabaseServer();
  const { error } = await db.rpc("update_task_status", { p_task: parsed.data.task_id, p_status: parsed.data.status });
  if (error) return { error: "Unable to update this task. Refresh and try again." };
  refreshTasks();
  return { success: "Status updated." };
}

export async function assignTask(input: unknown): Promise<Result> {
  const actor = await sessionProfile();
  if (actor?.role !== "main_admin") return denied;
  const parsed = z.object({ task_id: z.uuid(), assigned_user_id: z.uuid(), head_id: z.number().int().min(1).max(3) }).strict().safeParse(input);
  if (!parsed.success) return { error: "Select a user and a Head." };
  const db = await supabaseServer();
  const { error } = await db.rpc("assign_task", { p_task: parsed.data.task_id, p_assignee: parsed.data.assigned_user_id, p_head: parsed.data.head_id });
  if (error) return { error: "Unable to assign this task. Check the Head account setup." };
  refreshTasks();
  return { success: "Task assigned." };
}
