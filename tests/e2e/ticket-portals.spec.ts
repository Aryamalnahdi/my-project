import { test, expect } from "@playwright/test";

for (const portal of ["admin", "employee"] as const) {
  test(`${portal} login is separate and responsive`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/${portal}/login`);
    await expect(page.getByRole("heading", { name: portal === "admin" ? "Admin login" : "Employee login" })).toBeVisible();
    await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
    const password = page.getByLabel(portal === "admin" ? "Password" : "4-digit PIN", { exact: true });
    await expect(password).toHaveAttribute("type", "password");
    if (portal === "employee") {
      await expect(password).toHaveAttribute("pattern", "[0-9]{4}");
      await expect(password).toHaveAttribute("inputmode", "numeric");
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${portal}-${width}.png`), fullPage: true });
    }
    expect(errors).toEqual([]);
  });

  test(`${portal} protected routes redirect to its own login`, async ({ page }) => {
    const routes = portal === "admin" ? ["/admin", "/admin/accounts", "/admin/tickets", "/admin/tickets/00000000-0000-4000-8000-000000000001"]
      : ["/employee", "/employee/tickets", "/employee/tickets/new", "/employee/tickets/00000000-0000-4000-8000-000000000001"];
    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`/${portal}/login$`));
    }
  });

  test(`${portal} reports missing backend configuration`, async ({ page }) => {
    test.skip(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), "Only for an unconfigured environment.");
    await page.goto(`/${portal}/login`);
    await page.getByLabel("Username", { exact: true }).fill("test-account");
    await page.getByLabel(portal === "admin" ? "Password" : "4-digit PIN", { exact: true }).fill(portal === "admin" ? "test-password" : "0012");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("not configured");
  });
}

test("the home page opens employee login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/employee\/login$/);
});
