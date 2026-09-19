import { createClient } from "@supabase/supabase-js";
import { authEmail, canonicalUsername } from "../src/lib/identity";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const username = canonicalUsername(required("ADMIN_USERNAME"));
  const password = required("ADMIN_PASSWORD");
  if (password.length < 8 || password.length > 128) throw new Error("ADMIN_PASSWORD must contain 8–128 characters.");
  if (required("EMPLOYEE_PIN_PEPPER").length < 32) throw new Error("EMPLOYEE_PIN_PEPPER must contain at least 32 characters.");
  const db = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const ready = await db.from("employees").select("id", { head: true }).limit(1);
  if (ready.error) throw new Error("Apply migrations 001, 002, and 003 before provisioning the ticket administrator.");
  const existing = await db.from("profiles").select("id,username").eq("role", "main_admin").maybeSingle();
  if (existing.error) throw new Error("Unable to check the administrator account.");
  if (existing.data) {
    if (existing.data.username !== username) {
      throw new Error("A different Main Admin already exists. Reconcile that account with ADMIN_USERNAME before running this script; no existing data was changed.");
    }
    const updated = await db.auth.admin.updateUserById(existing.data.id, { email: authEmail(username), password, email_confirm: true });
    if (updated.error) throw new Error("Unable to set the administrator credentials. Check Supabase Auth password settings.");
    console.log("Existing ticket administrator credentials updated. No other accounts were modified.");
    return;
  }
  const created = await db.auth.admin.createUser({ email: authEmail(username), password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error("Unable to create the administrator. Check Auth settings and any incomplete account from an earlier setup.");
  const saved = await db.from("profiles").insert({
    id: created.data.user.id, name: process.env.ADMIN_NAME || "Administrator", username, role: "main_admin",
  });
  if (saved.error) {
    const cleanup = await db.auth.admin.deleteUser(created.data.user.id);
    if (cleanup.error) throw new Error("Administrator profile creation and rollback failed. Inspect incomplete Auth accounts before retrying.");
    throw new Error("Unable to save the administrator profile; the new Auth account was rolled back.");
  }
  console.log("Ticket administrator created. Sign in at /admin/login.");
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Administrator setup failed."); process.exitCode = 1; });
