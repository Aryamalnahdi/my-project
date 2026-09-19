import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "./supabase/server";
import type { Employee, Ticket } from "./types";

export const PAGE_SIZE = 20;
export function pageNumber(value?: string | string[]) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1;
}

const ticketFields = "id,ticket_number,employee_id,title,description,status,created_at,updated_at,employees!inner(profiles!inner(name,username)),ticket_notes(id,ticket_id,employee_id,note,created_at)";

export async function listEmployees(page = 1) {
  const db = await supabaseServer();
  const result = await db.from("employees").select("id,status,created_at,first_login_at,profiles!inner(name,username)", { count: "exact" })
    .order("created_at", { ascending: false }).order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (result.error) throw new Error("Unable to load employee accounts.");
  return { employees: result.data as unknown as Employee[], count: result.count ?? 0 };
}

export async function listTickets(employeeId?: string, page = 1, size = PAGE_SIZE) {
  const db = await supabaseServer();
  let query = db.from("tickets").select(ticketFields, { count: "exact" }).order("created_at", { ascending: false }).order("id")
    .order("created_at", { referencedTable: "ticket_notes", ascending: false }).limit(1, { referencedTable: "ticket_notes" });
  if (employeeId) query = query.eq("employee_id", employeeId);
  const result = await query.range((page - 1) * size, page * size - 1);
  if (result.error) throw new Error("Unable to load tickets.");
  return { tickets: result.data as unknown as Ticket[], count: result.count ?? 0 };
}

export async function getTicket(id: string, employeeId?: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await supabaseServer();
  let query = db.from("tickets").select(ticketFields).eq("id", id)
    .order("created_at", { referencedTable: "ticket_notes", ascending: true });
  if (employeeId) query = query.eq("employee_id", employeeId);
  const result = await query.maybeSingle();
  if (result.error) throw new Error("Unable to load the ticket.");
  if (!result.data) notFound();
  return result.data as unknown as Ticket;
}

export async function dashboardCounts() {
  const db = await supabaseServer();
  const results = await Promise.all([
    db.from("employees").select("id", { count: "exact", head: true }),
    db.from("employees").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("tickets").select("id", { count: "exact", head: true }),
  ]);
  if (results.some((result) => result.error)) throw new Error("Unable to load dashboard.");
  return { employees: results[0].count ?? 0, active: results[1].count ?? 0, tickets: results[2].count ?? 0 };
}
