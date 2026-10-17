import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

type Route = { path: string; landmarks: RegExp[] };
type Finding = { route: string; issues: string[] };

const adminRoutes: Route[] = [
  { path: "/admin", landmarks: [/dashboard|overview/i] },
  { path: "/admin/booking", landmarks: [/working hours/i, /closure/i, /booking mode/i] },
  { path: "/admin/team", landmarks: [/team/i] },
  { path: "/admin/services", landmarks: [/service/i] },
  { path: "/admin/appointments", landmarks: [/appointment/i] },
  { path: "/admin/users", landmarks: [/staff|user/i] },
  { path: "/admin/audit", landmarks: [/audit/i, /export/i] },
  { path: "/admin/reports", landmarks: [/report/i] },
  { path: "/admin/messaging", landmarks: [/messaging|provider|quiet hours/i] },
  { path: "/admin/announcements", landmarks: [/announcement/i] },
  { path: "/admin/locations", landmarks: [/location/i] },
  { path: "/admin/website", landmarks: [/website|cms/i] },
  { path: "/admin/note-templates", landmarks: [/template/i] },
  { path: "/admin/settings", landmarks: [/settings|clinic|profile/i] },
  { path: "/admin/account", landmarks: [/account|password/i] },
];

const doctorRoutes: Route[] = [
  { path: "/doctor", landmarks: [/schedule|waiting for you|unsigned/i] },
  { path: "/doctor/patients", landmarks: [/patient|search/i] },
  { path: "/doctor/tasks", landmarks: [/task/i] },
];

const receptionistRoutes: Route[] = [
  { path: "/reception", landmarks: [/dashboard|needs action/i] },
  { path: "/reception/appointments", landmarks: [/appointment/i] },
  { path: "/reception/appointments/requests", landmarks: [/request/i] },
  { path: "/reception/appointments/confirmations", landmarks: [/confirm/i] },
  { path: "/reception/schedule", landmarks: [/schedule/i] },
  { path: "/reception/check-in", landmarks: [/check.?in|waiting/i] },
  { path: "/reception/waitlist", landmarks: [/waitlist/i] },
  { path: "/reception/recalls", landmarks: [/recall/i] },
  { path: "/reception/patients", landmarks: [/patient|search/i] },
  { path: "/reception/reminders", landmarks: [/reminder/i] },
  { path: "/reception/messages", landmarks: [/message/i] },
  { path: "/reception/tasks", landmarks: [/task/i] },
  { path: "/reception/end-of-day", landmarks: [/end of day|reconcil/i] },
  { path: "/reception/leads", landmarks: [/lead/i] },
  { path: "/reception/account", landmarks: [/account|password/i] },
];

const publicRoutes: Route[] = [
  { path: "/", landmarks: [/book|service|team|hours/i] },
  { path: "/book", landmarks: [/book|slot|date/i] },
  { path: "/login", landmarks: [/email|password|sign in/i] },
  { path: "/privacy", landmarks: [/privacy/i] },
  { path: "/terms", landmarks: [/terms/i] },
  { path: "/accessibility", landmarks: [/accessib/i] },
];

async function auditRoute(page: Page, route: Route, info: TestInfo): Promise<Finding> {
  const issues: string[] = [];
  const networkErrors: string[] = [];
  const consoleErrors: string[] = [];
  let status: number | null = null;
  let responseBody = "";
  const onResponse = (response: import("@playwright/test").Response) => {
    if (response.status() >= 400 && !new URL(response.url()).pathname.endsWith("/favicon.ico")) {
      networkErrors.push(`${response.status()} ${response.url()}`);
    }
  };
  const onConsole = (message: import("@playwright/test").ConsoleMessage) => {
    if (message.type() === "error" && !/react devtools/i.test(message.text())) {
      consoleErrors.push(message.text());
    }
  };
  const onPageError = (error: Error) => {
    if (!/react devtools/i.test(error.message)) consoleErrors.push(error.message);
  };
  page.on("response", onResponse);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  try {
    const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    status = response?.status() ?? null;
    if (response && status >= 400) responseBody = await response.text().catch(() => "<unavailable>");
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  } catch (error) {
    issues.push(`a: navigation failed: ${String(error)}`);
  }

  const body = await page.locator("body").innerText().catch(() => "");
  const landmarkResults = route.landmarks.map((pattern) => {
    const found = pattern.test(body);
    if (!found) issues.push(`landmark: expected ${pattern} in body innerText`);
    return `${pattern}=${found}`;
  });
  if (status === null || status >= 400) {
    issues.push(`a: expected status < 400, got ${status ?? "no response"}${responseBody ? `; body=${responseBody}` : ""}`);
  }
  if (networkErrors.length) issues.push(`c: expected zero failed responses, got ${networkErrors.join(" | ")}`);
  if (consoleErrors.length) issues.push(`d: expected zero console errors, got ${consoleErrors.join(" | ")}`);

  page.off("response", onResponse);
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  console.log(
    `[AUDIT] ${route.path} | status=${status ?? "none"} | landmarks=${landmarkResults.join(", ")} | networkErrors=${networkErrors.length} | consoleErrors=${consoleErrors.length}`,
  );

  if (issues.length) {
    const dir = info.outputPath("audit-screenshots");
    await mkdir(dir, { recursive: true });
    const name = route.path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
    const screenshot = path.join(dir, `${name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    console.error(`[AUDIT FAILURE] ${route.path}\n${issues.join("\n")}\nScreenshot: ${screenshot}`);
  }
  return { route: route.path, issues };
}

async function assertNoFindings(findings: Finding[]): Promise<void> {
  expect(
    findings.flatMap(({ route, issues }) => issues.map((issue) => `${route}: ${issue}`)),
    "Route audit failures (route, assertion, actual vs expected)",
  ).toEqual([]);
}

async function login(page: Page, role: "admin" | "doctor" | "receptionist"): Promise<void> {
  const users = {
    admin: ["admin@marlowdental.com", process.env.ADMIN_PASSWORD || process.env.DEMO_ADMIN_PASSWORD || "AdminDemoPass2026!"],
    doctor: ["doctor@marlowdental.com", process.env.DOCTOR_PASSWORD || process.env.DEMO_DOCTOR_PASSWORD || "DoctorDemoPass2026!"],
    receptionist: ["receptionist@marlowdental.com", process.env.RECEPTIONIST_PASSWORD || process.env.DEMO_RECEPTIONIST_PASSWORD || "RecepDemoPass2026!"],
  } as const;
  const [email, password] = users[role];
  if (!password) throw new Error(`Login failed for ${role}: password environment variable is unset`);
  await page.goto("/login");
  await page.locator("input[type=email]").fill(email);
  await page.locator("input[type=password]").fill(password);
  await page.locator("button[type=submit]").click();
  try {
    await page.waitForURL(/\/(admin|doctor|reception)(\/|$)/, { timeout: 15000 });
  } catch {
    const error = await page.locator('[role="alert"], [data-toast="error"], .toast-error').allInnerTexts();
    throw new Error(`Login failed for ${role}: URL=${page.url()}; error=${error.join(" | ") || "none visible"}`);
  }
}

async function patientDetail(
  page: Page,
  info: TestInfo,
  area: "doctor" | "reception",
  landmarks: RegExp[],
): Promise<Finding> {
  const listPath = `/${area}/patients`;
  await page.goto(listPath);
  const patientLink = page.locator(`a[href^="${listPath}/"]`).first();
  try {
    await patientLink.waitFor({ state: "visible", timeout: 15000 });
  } catch {
    return { route: `${listPath}/<first-patient>`, issues: ["operability: first patient link is not visible"] };
  }
  await patientLink.click();
  try {
    await page.waitForURL(new RegExp(`/${area}/patients/[^/]+`), { timeout: 10000 });
  } catch {
    return {
      route: `${listPath}/<first-patient>`,
      issues: [`operability: expected patient detail URL; actual=${page.url()}`],
    };
  }
  return auditRoute(page, { path: new URL(page.url()).pathname, landmarks }, info);
}

test.describe("Frontend role accessibility audit", () => {
  test("Admin routes", async ({ page }, info) => {
    await login(page, "admin");
    const findings: Finding[] = [];
    for (const route of adminRoutes) findings.push(await auditRoute(page, route, info));
    await assertNoFindings(findings);
  });

  test("Doctor routes and clinical patient detail", async ({ page }, info) => {
    await login(page, "doctor");
    const findings: Finding[] = [];
    for (const route of doctorRoutes) findings.push(await auditRoute(page, route, info));
    findings.push(await patientDetail(page, info, "doctor", [
      /chart|odontogram/i,
      /note|soap/i,
      /treatment plan/i,
      /document|attachment|consent/i,
      /prescription|referral/i,
      /allerg|alert/i,
    ]));
    await assertNoFindings(findings);
  });

  test("Reception routes and patient billing", async ({ page }, info) => {
    test.setTimeout(60000);
    await login(page, "receptionist");
    const findings: Finding[] = [];
    for (const route of receptionistRoutes) findings.push(await auditRoute(page, route, info));
    findings.push(await patientDetail(page, info, "reception", [/billing|payment|ledger|balance/i]));
    await assertNoFindings(findings);
  });

  test("Public routes and booking availability state", async ({ page }, info) => {
    const findings: Finding[] = [];
    for (const route of publicRoutes) findings.push(await auditRoute(page, route, info));
    await page.goto("/book");
    await page.waitForLoadState("domcontentloaded");
    const continueBtn = page.locator("button:has-text('Continue')");
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
    }
    await page.waitForTimeout(1000);
    const slots = page.locator("button:has-text('AM'), button:has-text('PM')");
    const hasSlots = await slots.first().isVisible({ timeout: 5000 }).catch(() => false);
    const body = await page.locator("body").innerText();
    const pausedOrClosed = /paused|closed|booking (?:is )?(?:unavailable|not available)/i.test(body);
    if (!hasSlots && !pausedOrClosed) {
      findings.push({ route: "/book", issues: ["operability: expected visible time slots OR paused/closed banner; found neither"] });
    }
    await assertNoFindings(findings);
  });

  test("RBAC denials and doctor navigation", async ({ page }) => {
    for (const route of ["/admin", "/doctor", "/reception"]) {
      await page.goto(route);
      await page.waitForURL(/\/login(?:\?|$)/, { timeout: 10000 });
      expect(new URL(page.url()).pathname, `${route} should redirect to /login`).toBe("/login");
    }

    await login(page, "doctor");
    expect((await page.locator("nav").allInnerTexts()).join(" ")).not.toMatch(/staff accounts|audit logs/i);
    await page.goto("/admin/users");
    await page.waitForURL((url) => url.pathname !== "/admin/users", { timeout: 10000 });
    expect(new URL(page.url()).pathname).not.toBe("/admin/users");

    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await login(page, "receptionist");
    await page.goto("/admin/audit");
    await page.waitForURL((url) => url.pathname !== "/admin/audit", { timeout: 10000 });
    expect(new URL(page.url()).pathname).not.toBe("/admin/audit");
  });
});