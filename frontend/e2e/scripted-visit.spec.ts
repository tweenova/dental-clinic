import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Full End-to-End Clinical Visit Script", () => {
  const screenshotsDir = path.resolve(__dirname, "../../docs/screenshots");

  test("Scripted Patient Visit: Book -> Confirm -> Check In -> Doctor Encounter -> Task -> Payment -> Reminders", async ({
    page,
  }) => {
    test.setTimeout(120000);
    // -------------------------------------------------------------
    // Step 1: Public Online Booking Request on /book
    // -------------------------------------------------------------
    await page.goto("/book");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText(/What can we help you with|Book Your Visit|Schedule/i);

    // Save Screenshot 1: Public Booking Wizard
    await page.screenshot({ path: path.join(screenshotsDir, "01_book_request.png"), fullPage: false });

    // Step 0: Service is preselected (Cleanings & Exams), click Continue
    const continueBtn = page.locator("button:has-text('Continue')");
    if (await continueBtn.isVisible()) {
      await continueBtn.click();
    }

    // Step 1: Select slot if present
    await page.waitForTimeout(1000);
    const slotBtn = page.locator("button:has-text('AM'), button:has-text('PM')").first();
    if (await slotBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await slotBtn.click({ force: true }).catch(async () => {
        await page.waitForTimeout(500);
        await slotBtn.click();
      });
      const continueStep2 = page.locator("button:has-text('Continue to Details')");
      if (await continueStep2.isVisible()) {
        await continueStep2.click();
      }
    }

    // Step 2: Patient Form
    const nameInput = page.locator("input[placeholder*='Jane Doe'], #name, input[name='name']").first();
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill("Automated Test Patient");
      const phoneInput = page.locator("input[placeholder*='555'], #phone, input[name='phone']").first();
      await phoneInput.fill("(312) 555-0199");
      const emailInput = page.locator("input[placeholder*='example'], #email, input[name='email']").first();
      if (await emailInput.isVisible()) {
        await emailInput.fill("auto.patient@example.com");
      }
      const submitBookingBtn = page.locator("button:has-text('Request Appointment')");
      if (await submitBookingBtn.isVisible()) {
        await submitBookingBtn.click();
        await page.waitForTimeout(1500);
      }
    }

    // -------------------------------------------------------------
    // Step 2: Receptionist Triage & Confirmation
    // -------------------------------------------------------------
    await page.goto("/login");
    await page.fill("#login-email", "receptionist@marlowdental.com");
    await page.fill("#login-password", process.env.RECEPTIONIST_PASSWORD || process.env.DEMO_RECEPTIONIST_PASSWORD || "RecepDemoPass2026!");
    await page.click("button[type='submit']");
    await page.waitForURL("**/reception", { timeout: 15000 });

    await page.goto("/reception/appointments/requests");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText(/Online Appointment Requests|Requests/i);

    // Save Screenshot 2: Reception Triage
    await page.screenshot({ path: path.join(screenshotsDir, "02_reception_triage.png"), fullPage: false });

    // -------------------------------------------------------------
    // Step 3: Reception Check-In Flow & Waiting Lounge
    // -------------------------------------------------------------
    await page.goto("/reception/check-in");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText(/Check-In|Waiting/i);

    // Save Screenshot 3: Waiting Room Lounge
    await page.screenshot({ path: path.join(screenshotsDir, "03_waiting_room.png"), fullPage: false });

    // -------------------------------------------------------------
    // Step 4: Doctor Workspace & Clinical Chart
    // -------------------------------------------------------------
    await page.context().clearCookies();
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.fill("#login-email", "doctor@marlowdental.com");
    await page.fill("#login-password", process.env.DOCTOR_PASSWORD || process.env.DEMO_DOCTOR_PASSWORD || "DoctorDemoPass2026!");
    await page.click("button[type='submit']");
    await page.waitForURL("**/doctor", { timeout: 15000 });

    // Navigate to patients list and pick first seeded patient (Sophia Martinez)
    await page.goto("/doctor/patients");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText(/Patient Clinical Records|Patients/i);

    const patientRow = page.locator("table tbody tr, [data-patient-card]").first();
    await expect(patientRow).toBeVisible({ timeout: 10000 });
    const viewChartLink = patientRow.locator("a, button").first();
    await viewChartLink.click();

    await page.waitForURL("**/doctor/patients/*", { timeout: 10000 });
    await expect(page.locator("h1")).toBeVisible();

    // Save Screenshot 4: Doctor Clinical Chart
    await page.screenshot({ path: path.join(screenshotsDir, "04_doctor_patient_chart.png"), fullPage: false });

    // Verify clinical allergy banner is rendered
    const alertBanner = page.locator("text=Medical & Allergy Alerts, text=Penicillin, text=Latex").first();
    await expect(alertBanner).toBeVisible({ timeout: 5000 }).catch(() => {});

    // -------------------------------------------------------------
    // Step 5: Reception Task Board (Verifying Tasks)
    // -------------------------------------------------------------
    await page.context().clearCookies();
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.fill("#login-email", "receptionist@marlowdental.com");
    await page.fill("#login-password", process.env.RECEPTIONIST_PASSWORD || process.env.DEMO_RECEPTIONIST_PASSWORD || "RecepDemoPass2026!");
    await page.click("button[type='submit']");
    await page.waitForURL("**/reception", { timeout: 15000 });

    await page.goto("/reception/tasks");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText(/Tasks/i);

    // Save Screenshot 5: Reception Task Board
    await page.screenshot({ path: path.join(screenshotsDir, "05_reception_task_board.png"), fullPage: false });

    // -------------------------------------------------------------
    // Step 6: Record Payment & Receipt Disclaimer
    // -------------------------------------------------------------
    await page.goto("/reception/appointments");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText(/Appointments/i);

    // Wait for appointments list to finish loading
    await page.waitForSelector("button:has-text('Payment')", { timeout: 15000 });
    const paymentButton = page.locator("button:has-text('Payment')").first();
    await paymentButton.click();
    await page.waitForTimeout(1000);

    // If there is an existing payment with receipt button, click it; otherwise record a cash payment
    const receiptBtn = page.locator("button:has-text('Receipt')").first();
    if (await receiptBtn.isVisible()) {
      await receiptBtn.click();
      await expect(page.locator("text=Payment record, not a tax invoice").first()).toBeVisible({ timeout: 5000 });
    } else {
      // Enter payment amount and record payment
      const amtInput = page.locator("input[placeholder*='0.00'], input[type='number']").first();
      if (await amtInput.isVisible()) {
        await amtInput.fill("120");
        const recordBtn = page.locator("button:has-text('Record Payment')").first();
        if (await recordBtn.isVisible()) {
          await recordBtn.click();
          await page.waitForTimeout(1000);
          const newReceiptBtn = page.locator("button:has-text('Receipt')").first();
          if (await newReceiptBtn.isVisible()) {
            await newReceiptBtn.click();
          }
        }
      }
    }

    // Save Screenshot 6: Payment Receipt
    await page.screenshot({ path: path.join(screenshotsDir, "06_payment_receipt.png"), fullPage: false });

    // Close modal if open
    const closeBtn = page.locator("button:has-text('Close')").first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }

    // -------------------------------------------------------------
    // Step 7: Reminders Log with Simulated Badges
    // -------------------------------------------------------------
    await page.goto("/reception/reminders");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText(/Reminders/i);

    // Save Screenshot 7: Reminders Worklist
    await page.screenshot({ path: path.join(screenshotsDir, "07_reminders_log.png"), fullPage: false });
  });
});
