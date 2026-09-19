import { createClient } from "@supabase/supabase-js";
import { authEmail, canonicalUsername } from "../src/lib/identity";
import { passwordSchema, userSchema } from "../src/lib/validation";
import type { Role } from "../src/lib/types";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
type Account = { name: string; username: string; password: string; role: Role; headId?: number; lena?: boolean };

async function main() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const lenaHead = Number(required("LENA_HEAD_ID"));
  if (![1, 2, 3].includes(lenaHead)) throw new Error("LENA_HEAD_ID must be 1, 2, or 3.");
  const accounts: Account[] = [
    { name: required("ADMIN_NAME"), username: required("ADMIN_USERNAME"), password: required("ADMIN_PASSWORD"), role: "main_admin" },
    { name: "Lena baswed", username: "Lena baswed", password: required("LENA_PASSWORD"), role: "head", headId: lenaHead, lena: true },
    ...[1, 2, 3].filter((id) => id !== lenaHead).map((id) => ({ name: required(`HEAD_${id}_NAME`), username: required(`HEAD_${id}_USERNAME`), password: required(`HEAD_${id}_PASSWORD`), role: "head" as const, headId: id })),
  ];
  for (const account of accounts) {
    const parsed = userSchema.safeParse({ name: account.name, username: account.username, password: account.password });
    if (!parsed.success || !passwordSchema.safeParse(account.password).success) {
      throw new Error("An account has invalid input. Names and usernames are required; passwords must be 12–128 characters.");
    }
  }
  if (new Set(accounts.map((a) => canonicalUsername(a.username))).size !== 4) throw new Error("Initial account usernames must be distinct.");

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const account of accounts) {
    const username = canonicalUsername(account.username);
    const existing = await db.from("profiles").select("id,role").eq("username", username).maybeSingle();
    if (existing.error) throw new Error("Cannot read profiles. Apply the database migration first.");
    let userId: string;
    if (existing.data) {
      if (existing.data.role !== account.role) throw new Error("An existing account has a conflicting role. Setup stopped without modifying it.");
      userId = existing.data.id;
    } else {
      const created = await db.auth.admin.createUser({ email: authEmail(username), password: account.password, email_confirm: true });
      if (created.error || !created.data.user) throw new Error("An initial Auth account could not be created. Check for an existing incomplete account and Auth configuration.");
      userId = created.data.user.id;
      const saved = await db.from("profiles").insert({ id: userId, name: account.name, username, role: account.role });
      if (saved.error) {
        const cleanup = await db.auth.admin.deleteUser(userId);
        if (cleanup.error) throw new Error("Profile creation and rollback failed. Inspect incomplete Auth accounts before retrying.");
        throw new Error("Initial profile creation failed; the new Auth account was rolled back.");
      }
    }
    if (account.headId) {
      const configured = await db.rpc("configure_initial_head", { p_user: userId, p_head: account.headId, p_is_lena: Boolean(account.lena) });
      if (configured.error) throw new Error("A Head could not be configured. Check the Head mapping; existing assignments are never replaced by this script.");
    }
  }
  console.log("Admin and three Head accounts are provisioned. Existing passwords were not changed.");
  console.log("Remove initial account passwords from the environment after setup. Confirm and configure normal-user task routing before launch.");
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Account setup failed."); process.exitCode = 1; });
