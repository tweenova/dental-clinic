import { test, expect, Response } from "@playwright/test";

test.describe("Role-Based Access Control and Navigation Audits", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      console.error(`Page error: ${err.message}`);
    });
  });

  test("1. Administrator: Can log in, visit every admin page, with zero errors or 4xx/5xx", async ({ page }) => {
    // 1. Log in
    await page.goto("/login");
    await page.fill("#login-email", "admin@marlowdental.com");
    await page.fill("#login-password", process.env.ADMIN_PASSWORD || process.env.DEMO_ADMIN_PASSWORD || "AdminDemoPass2026!");
    await page.click("button[type='submit']");
    await page.waitForURL("**/admin", { timeout: 15000 });

    const adminLinks = [
      "/admin",
      "/admin/appointments",
      "/admin/reports",
      "/admin/audit",
      "/admin/booking",
      "/admin/messaging",
      "/admin/note-templates",
      "/admin/locations",
      "/admin/services",
      "/admin/team",
      "/admin/users",
      "/admin/announcements",
      "/admin/website",
      "/admin/settings",
      "/admin/account",
    ];

    for (const link of adminLinks) {
      const failedResponses: string[] = [];
      const onResponse = (resp: Response) => {
        const url = resp.url();
        if (
          resp.status() >= 400 &&
          !url.includes("/favicon.ico") &&
          !url.includes("/api/v1/auth/refresh")
        ) {
          failedResponses.push(`${resp.status()} ${url}`);
        }
      };
      page.on("response", onResponse);

      await page.goto(link);
      await page.waitForLoadState("domcontentloaded");

      // Verify main content exists
      const main = page.locator("main");
      await expect(main).toBeVisible({ timeout: 10000 });

      // Verify no error toast is displayed
      const errorToast = page.locator("[data-toast='error'], .toast-error");
      await expect(errorToast).toHaveCount(0);

      // Verify no 4xx or 5xx responses were caught during navigation
      expect(failedResponses).toEqual([]);
      page.off("response", onResponse);
    }
  });

  test("2. Receptionist: Can access front office, forbidden admin links absent, direct admin URL redirected", async ({ page }) => {
    // 1. Log in as Receptionist
    await page.goto("/login");
    await page.fill("#login-email", "receptionist@marlowdental.com");
    await page.fill("#login-password", process.env.RECEPTIONIST_PASSWORD || process.env.DEMO_RECEPTIONIST_PASSWORD || "RecepDemoPass2026!");
    await page.click("button[type='submit']");
    await page.waitForURL("**/reception", { timeout: 15000 });

    const receptionLinks = [
      "/reception",
      "/reception/schedule",
      "/reception/appointments",
      "/reception/reminders",
      "/reception/appointments/requests",
      "/reception/appointments/confirmations",
      "/reception/check-in",
      "/reception/end-of-day",
      "/reception/patients",
      "/reception/tasks",
      "/reception/messages",
      "/reception/recalls",
      "/reception/waitlist",
      "/reception/leads",
      "/reception/account",
    ];

    for (const link of receptionLinks) {
      await page.goto(link);
      await page.waitForLoadState("domcontentloaded");

      const main = page.locator("main");
      await expect(main).toBeVisible({ timeout: 10000 });
      await expect(page.locator("[data-toast='error'], .toast-error")).toHaveCount(0);
    }

    // Assert forbidden admin links are absent from sidebar
    await expect(page.locator("a[href='/admin/audit']")).toHaveCount(0);
    await expect(page.locator("a[href='/admin/permissions']")).toHaveCount(0);
    await expect(page.locator("a[href='/admin/reports']")).toHaveCount(0);

    // Assert direct navigation to /admin is redirected or denied
    await page.goto("/admin");
    await page.waitForURL((url) => !url.pathname.startsWith("/admin"), { timeout: 10000 });
    expect(page.url()).toMatch(/\/reception|\/login/);
  });

  test("3. Doctor: Can access clinical workspace, forbidden links absent, direct admin URL redirected", async ({ page }) => {
    // 1. Log in as Doctor
    await page.goto("/login");
    await page.fill("#login-email", "doctor@marlowdental.com");
    await page.fill("#login-password", process.env.DOCTOR_PASSWORD || process.env.DEMO_DOCTOR_PASSWORD || "DoctorDemoPass2026!");
    await page.click("button[type='submit']");
    await page.waitForURL("**/doctor", { timeout: 15000 });

    const doctorLinks = [
      "/doctor",
      "/doctor/patients",
      "/doctor/tasks",
    ];

    for (const link of doctorLinks) {
      await page.goto(link);
      await page.waitForLoadState("domcontentloaded");

      const main = page.locator("main");
      await expect(main).toBeVisible({ timeout: 10000 });
      await expect(page.locator("[data-toast='error'], .toast-error")).toHaveCount(0);
    }

    // Assert forbidden links absent
    await expect(page.locator("a[href='/admin/audit']")).toHaveCount(0);
    await expect(page.locator("a[href='/reception/reminders']")).toHaveCount(0);

    // Assert direct navigation to /admin is redirected or denied
    await page.goto("/admin");
    await page.waitForURL((url) => !url.pathname.startsWith("/admin"), { timeout: 10000 });
    expect(page.url()).toMatch(/\/doctor|\/login/);
  });
});
