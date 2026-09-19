import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// This test only touches accounts it creates, against an explicitly opted-in dev project.
// Disable artifacts so the creation-time PIN and session cookies are not captured.
test.use({ trace: "off", screenshot: "off", video: "off" });
test("hosted Admin -> Employee -> Ticket -> Admin Note flow", async ({ browser }) => {
  test.skip(process.env.TICKET_E2E_LIVE !== "1", "Requires explicit opt-in and a configured development Supabase project.");
  test.setTimeout(180000);
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_USERNAME", "ADMIN_PASSWORD"]) {
    if (!process.env[key]) throw new Error(`Missing ${key} for the hosted test.`);
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15_000) }) },
  });
  const cleanupIds: string[] = [];
  const adminContext = await browser.newContext();
  const employeeContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const employee = await employeeContext.newPage();
  const bob = await bobContext.newPage();
  const unique = Date.now().toString();
  const title = `Test support request ${unique}`;
  const testNames = [`Test Alice ${unique}`, `Test Bob ${unique}`];
  function progress(step: string) { console.log(`Hosted workflow: ${step}`); }
  try {
    progress("admin login");
    await admin.goto("/admin/login");
    await admin.getByLabel("Username", { exact: true }).fill(process.env.ADMIN_USERNAME!);
    await admin.getByLabel("Password", { exact: true }).fill(process.env.ADMIN_PASSWORD!);
    await admin.getByRole("button", { name: "Log in" }).click();
    await expect(admin).toHaveURL(/\/admin$/);
    await admin.getByRole("link", { name: "Accounts", exact: true }).click();

    async function createAccount(name: string) {
      progress("create employee account");
      await admin.getByRole("button", { name: "Create Account", exact: true }).click();
      const dialog = admin.getByRole("dialog");
      await dialog.getByLabel(/Employee name/).fill(name);
      await dialog.getByRole("button", { name: "Create account", exact: true }).click();
      await expect(dialog.getByTestId("generated-pin")).toBeVisible();
      const username = (await dialog.getByTestId("generated-username").textContent())!;
      const pin = (await dialog.getByTestId("generated-pin").textContent())!;
      const profile = await db.from("profiles").select("id").eq("username", username).single();
      if (profile.error || !profile.data) throw new Error("Created account could not be found for test cleanup.");
      cleanupIds.push(profile.data.id);
      await dialog.getByRole("button", { name: "I’ve saved the credentials" }).click();
      await expect(admin.getByRole("row").filter({ hasText: username })).toContainText("Inactive");
      return { username, pin };
    }
    const alice = await createAccount(testNames[0]);
    const bobAccount = await createAccount(testNames[1]);
    await admin.reload();
    await expect(admin.getByTestId("generated-pin")).toHaveCount(0);

    progress("employee login and activation");
    await employee.goto("/employee/login");
    await employee.getByLabel("Username", { exact: true }).fill(alice.username);
    await employee.getByLabel("4-digit PIN", { exact: true }).fill(alice.pin);
    await employee.getByRole("button", { name: "Log in" }).click();
    await expect(employee).toHaveURL(/\/employee$/);
    await employee.reload();
    await expect(employee.getByRole("heading", { name: "How can we help?" })).toBeVisible();
    await expect(admin.getByRole("row").filter({ hasText: alice.username })).toContainText("Active", { timeout: 15000 });

    progress("create ticket and receive live update");
    await admin.getByRole("link", { name: "Tickets", exact: true }).click();
    await employee.getByRole("link", { name: "Create Ticket", exact: true }).first().click();
    await employee.getByLabel("Problem Title", { exact: true }).fill(title);
    await employee.getByLabel("Problem Description", { exact: true }).fill("The application is showing an unexpected error.");
    await employee.getByRole("button", { name: "Create Ticket", exact: true }).click();
    await expect(employee.getByRole("status")).toContainText("Ticket created");
    await employee.getByRole("link", { name: "View ticket", exact: true }).click();
    const employeeTicketUrl = employee.url();
    await expect(employee.getByRole("heading", { name: title })).toBeVisible();
    await expect(admin.getByRole("link", { name: new RegExp(title) })).toBeVisible({ timeout: 15000 });
    await admin.getByRole("link", { name: new RegExp(title) }).click();
    progress("admin notes and employee live updates");
    for (const note of ["Please sign out and back in.", "Let us know if this continues."]) {
      await admin.getByLabel("Send a note to the employee").fill(note);
      await admin.getByRole("button", { name: "Send note", exact: true }).click();
      await expect(admin.getByRole("status")).toContainText("Note sent");
      await expect(employee.locator(".admin-note").filter({ hasText: note })).toBeVisible({ timeout: 15000 });
    }
    await employee.setViewportSize({ width: 390, height: 844 });
    expect(await employee.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    progress("cross-account isolation and logout");
    await bob.goto("/employee/login");
    await bob.getByLabel("Username", { exact: true }).fill(bobAccount.username);
    await bob.getByLabel("4-digit PIN", { exact: true }).fill(bobAccount.pin);
    await bob.getByRole("button", { name: "Log in" }).click();
    await expect(bob).toHaveURL(/\/employee$/);
    await expect(bob.getByText("You haven’t created any tickets")).toBeVisible();
    await bob.goto(employeeTicketUrl);
    await expect(bob.getByRole("heading", { name: "Ticket unavailable" })).toBeVisible();
    for (const route of ["/admin", "/admin/accounts", "/admin/tickets"]) {
      await bob.goto(route);
      await expect(bob).toHaveURL(/\/employee$/);
    }
    await bob.getByRole("button", { name: "Logout", exact: true }).click();
    await expect(bob).toHaveURL(/\/employee\/login$/);
    await bob.goto("/employee/tickets");
    await expect(bob).toHaveURL(/\/employee\/login$/);
    await admin.getByRole("button", { name: "Logout", exact: true }).click();
    await expect(admin).toHaveURL(/\/admin\/login$/);
    await admin.goto("/admin/accounts");
    await expect(admin).toHaveURL(/\/admin\/login$/);
  } finally {
    progress("remove temporary test records");
    // A timed-out UI response may still have created an account. Recover only
    // this run's exact names, and clean data before potentially slow browser teardown.
    const remaining = await db.from("profiles").select("id").eq("role", "employee").in("name", testNames);
    if (remaining.error) throw new Error("Unable to find this run's temporary accounts for cleanup.");
    const allIds = new Set([...cleanupIds, ...remaining.data.map(({ id }) => id as string)]);
    for (const id of allIds) {
      for (const [table, column] of [["ticket_notes", "employee_id"], ["tickets", "employee_id"], ["employees", "id"], ["profiles", "id"]]) {
        const result = await db.from(table).delete().eq(column, id);
        if (result.error) throw new Error(`Test cleanup failed in ${table}; inspect the temporary test accounts.`);
      }
      const result = await db.auth.admin.deleteUser(id);
      if (result.error) throw new Error("Test Auth account cleanup failed; inspect the temporary test accounts.");
    }
    // The Playwright browser fixture also tears down remaining contexts.
    await Promise.race([
      Promise.allSettled([adminContext.close(), employeeContext.close(), bobContext.close()]),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
});
