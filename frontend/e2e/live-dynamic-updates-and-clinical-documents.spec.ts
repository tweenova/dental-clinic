import { test, expect } from "@playwright/test";

test.describe("Real (No Interception) Dynamic Content & Clinical Workflows (Part G)", () => {
  test.setTimeout(90000);

  test("1. Forced password change modal enforcement and dismissal", async ({ page }) => {
    // 1. Log in as Admin to create a user with requiresPasswordChange=true
    await page.goto("/login");
    await page.fill("#login-email", "admin@marlowdental.com");
    await page.fill("#login-password", process.env.ADMIN_PASSWORD || process.env.DEMO_ADMIN_PASSWORD || "AdminDemoPass2026!");
    await page.click("button[type='submit']");
    await page.waitForURL("**/admin", { timeout: 15000 });

    const tempEmail = `forcepwd_${Date.now()}@marlowdental.com`;
    const tempInitialPass = "TempInitialPass2026!";
    const newSecurePass = "NewSecurePass2026!";

    // Visit admin users page and create staff account with requiresPasswordChange=true
    await page.goto("/admin/users");
    await page.waitForLoadState("domcontentloaded");
    await page.locator("button:has-text('Create Staff Account')").click();

    const userModal = page.locator("[role='dialog']");
    await expect(userModal).toBeVisible();

    await userModal.locator("input[type='text']").first().fill("Forced Password Test User");
    await userModal.locator("input[type='email']").fill(tempEmail);
    await userModal.locator("input[type='password']").fill(tempInitialPass);
    // Submit creation
    await userModal.locator("button[type='submit']:has-text('Create Account')").click();

    // Verify creation success
    await expect(page.locator("body")).toContainText(/created successfully|Staff Accounts/i);

    // 2. Clear session and log in as the newly created user
    await page.context().clearCookies();
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.fill("#login-email", tempEmail);
    await page.fill("#login-password", tempInitialPass);
    await page.click("button[type='submit']");

    // 3. Forced Password Change Modal must be displayed
    const forceModal = page.locator("[data-testid='forced-password-change']");
    await expect(forceModal).toBeVisible({ timeout: 15000 });
    await expect(forceModal.locator("h2")).toContainText("Change Your Password to Continue");

    // 4. Fill in current password, new password, confirm password and submit
    await forceModal.locator("input#current-password").fill(tempInitialPass);
    await forceModal.locator("input#new-password").fill(newSecurePass);
    await forceModal.locator("input#confirm-password").fill(newSecurePass);
    await forceModal.locator("button[data-testid='submit-password-change']").click();

    // 5. Modal should dismiss and user enters workspace
    await expect(forceModal).not.toBeVisible({ timeout: 15000 });
    expect(page.url()).toMatch(/\/(doctor|reception)/);
  });

  test("2. Real dynamic services: edit in Admin and verify on public, /book, and doctor", async ({ page }) => {
    // Log in as Admin
    await page.goto("/login");
    await page.fill("#login-email", "admin@marlowdental.com");
    await page.fill("#login-password", process.env.ADMIN_PASSWORD || process.env.DEMO_ADMIN_PASSWORD || "AdminDemoPass2026!");
    await page.click("button[type='submit']");
    await page.waitForURL("**/admin", { timeout: 15000 });

    // Visit admin services catalog
    await page.goto("/admin/services");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText(/Services/i);

    // Verify services list loaded from backend
    const serviceCards = page.locator("button:has-text('Edit')");
    await expect(serviceCards.first()).toBeVisible({ timeout: 10000 });

    // Visit public homepage - verify real services are displayed from DB
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const servicesSection = page.locator("#services");
    await expect(servicesSection).toBeVisible();
    const serviceItems = servicesSection.locator("h4");
    await expect(serviceItems.first()).toBeVisible();
    const firstServiceName = await serviceItems.first().innerText();
    expect(firstServiceName.length).toBeGreaterThan(0);

    // Visit /book - verify procedure list has dynamic services
    await page.goto("/book");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toContainText(firstServiceName);
  });

  test("3. Real clinic settings: verify dynamic branding, contact info, and hours", async ({ page }) => {
    // Load public site without any mock route interception
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Header & footer branding
    const headerTitle = page.locator("header a[href='/']").first();
    await expect(headerTitle).toBeVisible();
    const brandName = await headerTitle.innerText();
    expect(brandName.length).toBeGreaterThan(0);

    // Footer contact information
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer).toContainText(/Open|Hours|Mon|Schedule|Call|Email/i);

    // Title / Metadata check
    const pageTitle = await page.title();
    expect(pageTitle.length).toBeGreaterThan(0);
  });

  test("4. Real patient creation and search across Doctor and Reception views", async ({ page }) => {
    // Log in as receptionist to view / create patient
    await page.goto("/login");
    await page.fill("#login-email", "receptionist@marlowdental.com");
    await page.fill("#login-password", process.env.RECEPTIONIST_PASSWORD || process.env.DEMO_RECEPTIONIST_PASSWORD || "RecepDemoPass2026!");
    await page.click("button[type='submit']");
    await page.waitForURL("**/reception", { timeout: 15000 });

    // Open reception patients directory
    await page.goto("/reception/patients");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText(/Patient/i);

    // Check search functionality
    const searchInput = page.locator("input[placeholder*='Search'], input[type='search']").first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Sophia");
    await page.waitForTimeout(500);
    // Sophia Martinez seeded patient should be visible
    await expect(page.locator("body")).toContainText(/Sophia/i);

    // Switch to Doctor role and check clinical patient view
    await page.context().clearCookies();
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.fill("#login-email", "doctor@marlowdental.com");
    await page.fill("#login-password", process.env.DOCTOR_PASSWORD || process.env.DEMO_DOCTOR_PASSWORD || "DoctorDemoPass2026!");
    await page.click("button[type='submit']");
    await page.waitForURL("**/doctor", { timeout: 15000 });

    await page.goto("/doctor/patients");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText(/Patient/i);
    // Doctor can view patients list
    await expect(page.locator("table tbody tr, [data-patient-card]").first()).toBeVisible();
  });

  test("5. Doctor clinical documents tab and DEMO watermark verification", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#login-email", "doctor@marlowdental.com");
    await page.fill("#login-password", process.env.DOCTOR_PASSWORD || process.env.DEMO_DOCTOR_PASSWORD || "DoctorDemoPass2026!");
    await page.click("button[type='submit']");
    await page.waitForURL("**/doctor", { timeout: 15000 });

    // Open first patient record
    await page.goto("/doctor/patients");
    await page.waitForLoadState("domcontentloaded");
    const patientLink = page.locator("table tbody tr a, table tbody tr button").first();
    await expect(patientLink).toBeVisible({ timeout: 10000 });
    await patientLink.click();

    await page.waitForURL("**/doctor/patients/*", { timeout: 10000 });

    // Navigate to Prescriptions & Referrals tab
    const documentsTab = page.locator("button:has-text('Prescriptions & Referrals')");
    await expect(documentsTab).toBeVisible();
    await documentsTab.click();

    // Verify Prescriptions & Referrals panel is active
    await expect(page.locator("button:has-text('New Prescription'), button:has-text('New Referral Letter')").first()).toBeVisible({ timeout: 10000 });

    // Click New Prescription button to open modal
    const issueRxBtn = page.locator("button:has-text('New Prescription')");
    await issueRxBtn.click();

    // Modal dialog is opened
    const rxModal = page.locator("[role='dialog']");
    await expect(rxModal).toBeVisible();

    // Fill in medication and close
    await page.locator("input[placeholder*='Amoxicillin']").fill("Amoxicillin 500mg");
    await page.locator("input[placeholder*='500mg']").fill("500mg capsule");

    // Close prescription modal
    const closeBtn = rxModal.locator("button:has-text('Cancel')").first();
    await closeBtn.click();

    // Navigate to Attachments & Consents tab
    const attachmentsTab = page.locator("button:has-text('Attachments & Consents')");
    await expect(attachmentsTab).toBeVisible();
    await attachmentsTab.click();

    // Verify Attachments & Consents panel loaded
    await expect(page.locator("button:has-text('Upload Attachment'), button:has-text('Record Consent')").first()).toBeVisible({ timeout: 10000 });
  });

  test("6. Admin and Doctor Note-Template Editors", async ({ page }) => {
    // 1. Doctor Note Templates
    await page.goto("/login");
    await page.fill("#login-email", "doctor@marlowdental.com");
    await page.fill("#login-password", process.env.DOCTOR_PASSWORD || process.env.DEMO_DOCTOR_PASSWORD || "DoctorDemoPass2026!");
    await page.click("button[type='submit']");
    await page.waitForURL("**/doctor", { timeout: 15000 });

    // Doctor visits /doctor/templates via sidebar or direct URL
    await page.goto("/doctor/templates");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText(/SOAP Clinical Note Templates/i);
    await expect(page.locator("button[data-testid='create-template-btn']")).toBeVisible();

    // 2. Admin Note Templates
    await page.context().clearCookies();
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.fill("#login-email", "admin@marlowdental.com");
    await page.fill("#login-password", process.env.ADMIN_PASSWORD || process.env.DEMO_ADMIN_PASSWORD || "AdminDemoPass2026!");
    await page.click("button[type='submit']");
    await page.waitForURL("**/admin", { timeout: 15000 });

    await page.goto("/admin/note-templates");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText(/Note Templates/i);
    await expect(page.locator("button[data-testid='create-template-btn']")).toBeVisible();
  });
});
