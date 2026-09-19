import "server-only";
import { createHash } from "node:crypto";
import { authEmail, canonicalUsername } from "./identity";
import { employeePassword } from "./employee-credentials";
import { loginSchema } from "./validation";
import { employeeLoginSchema } from "./ticket-validation";
import { isConfigured, supabaseServer } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";
import { roleRoute, type Role } from "./types";

export type LoginResult = { error?: string; destination?: string };
export async function authenticate(input: unknown, portal: "admin" | "employee" | "legacy"): Promise<LoginResult> {
  const parsed = (portal === "employee" ? employeeLoginSchema : loginSchema).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!isConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY || (portal === "employee" && !process.env.EMPLOYEE_PIN_PEPPER)) {
    return { error: "The platform is not configured yet. Please contact your administrator." };
  }
  const invalid = { error: "Unable to sign in. Check your credentials and login page, then try again." };
  try {
    const username = canonicalUsername(parsed.data.username);
    const key = createHash("sha256").update(username).digest("hex");
    const admin = supabaseAdmin();
    const attempt = await admin.rpc("consume_ticket_login_attempt", { p_key: key });
    if (attempt.error) return { error: "Sign in is temporarily unavailable. Please try again later." };
    if (!attempt.data) return { error: "Too many sign-in attempts. Please try again in 15 minutes." };
    const password = portal === "employee"
      ? employeePassword(username, parsed.data.password, process.env.EMPLOYEE_PIN_PEPPER!)
      : parsed.data.password;
    const db = await supabaseServer();
    const signedIn = await db.auth.signInWithPassword({ email: authEmail(username), password });
    if (signedIn.error || !signedIn.data.user) return invalid;
    const { data, error } = await db.from("profiles").select("role").eq("id", signedIn.data.user.id).single();
    const role = data?.role as Role | undefined;
    const allowed = portal === "admin" ? role === "main_admin" : portal === "employee" ? role === "employee" : role === "head" || role === "normal_user";
    if (error || !role || !allowed) { await db.auth.signOut({ scope: "local" }); return invalid; }
    if (role === "employee") {
      const active = await db.rpc("activate_employee");
      if (active.error) {
        await db.auth.signOut({ scope: "local" });
        return { error: "Your account could not be activated. Please try again." };
      }
    }
    await admin.rpc("clear_ticket_login_attempts", { p_key: key });
    return { destination: roleRoute[role] };
  } catch {
    return { error: "Unable to connect. Please try again." };
  }
}
