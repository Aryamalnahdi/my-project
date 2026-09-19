"use server";

import { revalidatePath } from "next/cache";
import { sessionProfile } from "@/lib/auth";
import { authenticate } from "@/lib/login";
import { employeePassword, generateEmployeeCredentials } from "@/lib/employee-credentials";
import { authEmail } from "@/lib/identity";
import { employeeSchema, ticketSchema, ticketNoteSchema } from "@/lib/ticket-validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import type { Result } from "./actions";

export type AccountResult = Result & { credentials?: { username: string; pin: string } };
export async function adminLogin(input: unknown) { return authenticate(input, "admin"); }
export async function employeeLogin(input: unknown) { return authenticate(input, "employee"); }

export async function createEmployee(input: unknown): Promise<AccountResult> {
  const actor = await sessionProfile();
  if (actor?.role !== "main_admin") return { error: "You do not have permission to create accounts." };
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { error: "Use a name of at most 100 characters." };
  const pepper = process.env.EMPLOYEE_PIN_PEPPER;
  if (!pepper || pepper.length < 32 || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Account creation is not configured. Contact the platform administrator." };
  }
  try {
    const admin = supabaseAdmin();
    for (let attempt = 0; attempt < 3; attempt++) {
      const credentials = generateEmployeeCredentials();
      const created = await admin.auth.admin.createUser({
        email: authEmail(credentials.username),
        password: employeePassword(credentials.username, credentials.pin, pepper),
        email_confirm: true,
      });
      if (created.error || !created.data.user) {
        if (["email_exists", "user_already_exists"].includes(created.error?.code ?? "")) continue;
        return { error: "Unable to create the account. Please try again." };
      }
      const saved = await admin.rpc("provision_employee", {
        p_id: created.data.user.id, p_username: credentials.username,
        p_name: parsed.data.name || credentials.username,
      });
      if (saved.error) {
        const cleanup = await admin.auth.admin.deleteUser(created.data.user.id);
        if (cleanup.error) {
          console.error("Incomplete employee account requires cleanup", created.data.user.id);
          return { error: "Account setup failed. Contact the platform administrator before retrying." };
        }
        if (saved.error.code === "23505") continue;
        return { error: "Unable to save the account. Please try again." };
      }
      revalidatePath("/admin/accounts");
      revalidatePath("/admin");
      return { success: "Account created. Save these credentials now; the PIN is shown only once.", credentials };
    }
    return { error: "Unable to generate an available username. Please try again." };
  } catch { return { error: "Unable to connect. Please try again." }; }
}

export async function createTicket(input: unknown): Promise<Result & { ticketId?: string }> {
  const actor = await sessionProfile();
  if (actor?.role !== "employee") return { error: "You do not have permission to create tickets." };
  const parsed = ticketSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const db = await supabaseServer();
    const saved = await db.rpc("create_ticket", { p_title: parsed.data.title, p_description: parsed.data.description });
    if (saved.error || !saved.data) return { error: "Unable to create the ticket. Please try again." };
    ["/employee", "/employee/tickets", "/admin", "/admin/tickets"].forEach((path) => revalidatePath(path));
    return { success: "Ticket created. Your administrator can now see it.", ticketId: saved.data as string };
  } catch { return { error: "Unable to connect. Please try again." }; }
}

export async function addTicketNote(input: unknown): Promise<Result> {
  const actor = await sessionProfile();
  if (actor?.role !== "main_admin") return { error: "You do not have permission to send notes." };
  const parsed = ticketNoteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const db = await supabaseServer();
    const saved = await db.rpc("add_ticket_note", { p_ticket_id: parsed.data.ticket_id, p_note: parsed.data.note });
    if (saved.error) return { error: "Unable to send the note. Refresh the ticket and try again." };
    ["/admin/tickets", `/admin/tickets/${parsed.data.ticket_id}`, `/employee/tickets/${parsed.data.ticket_id}`].forEach((path) => revalidatePath(path));
    return { success: "Note sent. The employee can see it in their ticket." };
  } catch { return { error: "Unable to connect. Please try again." }; }
}
