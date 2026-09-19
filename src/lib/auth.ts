import "server-only";
import { redirect } from "next/navigation";
import { isConfigured, supabaseServer } from "./supabase/server";
import { type Profile, type Role, roleRoute } from "./types";

export async function sessionProfile() {
  if (!isConfigured()) return null;
  const db = await supabaseServer();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return null;
  const { data } = await db.from("profiles").select("id,name,username,role").eq("id", user.id).single();
  return data as Profile | null;
}

export async function requireRole(role: Role) {
  const profile = await sessionProfile();
  if (!profile) redirect(role === "main_admin" ? "/admin/login" : role === "employee" ? "/employee/login" : "/login");
  if (profile.role !== role) redirect(roleRoute[profile.role]);
  return profile;
}
