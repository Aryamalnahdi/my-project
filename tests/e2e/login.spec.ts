import { test, expect } from "@playwright/test";

test("login uses username/password and fits desktop and mobile", async ({ page }, testInfo) => {
  const exceptions: string[] = [];
  page.on("pageerror", (error) => exceptions.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await expect.poll(() => page.locator(".brand img").evaluateAll((images) => images.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("login-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("login-mobile.png"), fullPage: true });
  expect(exceptions).toEqual([]);
});

test("unauthenticated users cannot open any dashboard", async ({ page }) => {
  for (const route of ["/head", "/my-tasks"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  }
});

test("missing backend configuration produces clear login feedback", async ({ page }) => {
  test.skip(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), "Only checks an unconfigured local environment.");
  await page.goto("/login");
  await page.getByLabel("Username").fill("test user");
  await page.getByLabel("Password").fill("test-only-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.locator(".feedback[role=alert]")).toContainText("not configured");
});
