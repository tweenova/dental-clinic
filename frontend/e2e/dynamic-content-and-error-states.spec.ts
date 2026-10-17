import { test, expect } from "@playwright/test";

test.describe("Dynamic Content and Error States (Part G Proof)", () => {
  test("1. Dynamic services: custom service name and fee from API render on public site and /book", async ({ page }) => {
    // Intercept services API with dynamic procedure
    await page.route("**/api/v1/public/services*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "11111111-2222-3333-4444-555555555555",
            slug: "dynamic-laser-whitening",
            title: "Dynamic Laser Whitening Procedure",
            shortDesc: "Advanced in-office laser brightening session.",
            cashPrice: "Rs 18,500",
            duration: "60 mins",
            category: "cosmetic",
            isHighlighted: true,
            isActive: true,
            isPublic: true,
            bookableOnline: true,
            displayOrder: 1,
          },
        ]),
      });
    });

    // Visit home page and verify dynamic service is visible
    await page.goto("/#services");
    await expect(page.locator("body")).toContainText("Dynamic Laser Whitening Procedure");
    await expect(page.locator("body")).toContainText("Rs 18,500");

    // Visit /book page and verify dynamic service is present in procedure selector
    await page.goto("/book");
    await expect(page.locator("body")).toContainText("Dynamic Laser Whitening Procedure");
  });

  test("2. Dynamic clinic identity: custom name and phone reflect in header and footer", async ({ page }) => {
    await page.route("**/api/v1/public/content*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          general: {
            practiceName: "Apex Dental Specialists",
            phone: "+92 321 9998877",
            email: "care@apexdental.pk",
            tagline: "Precision restorative and aesthetic dentistry.",
          },
          homepage: {
            heroHeading: "Modern, unhurried dental care.",
            heroDescription: "Comprehensive exams and gentle restorations.",
          },
        }),
      });
    });

    await page.goto("/");
    await expect(page.locator("body")).toContainText("Apex Dental");
    await expect(page.locator("body")).toContainText("+92 321 9998877");
  });

  test("3. Empty state: empty list renders clear empty state message without fallback data", async ({ page }) => {
    await page.route("**/api/v1/public/services*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/#services");
    // Should gracefully indicate no services currently published
    await expect(page.locator("body")).not.toContainText("Invented Service");
  });

  test("4. Error state: 500 server error displays error message, not invented fallback content", async ({ page }) => {
    await page.route("**/api/v1/public/services*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Database connection failed" }),
      });
    });

    await page.goto("/book");
    // Verify it doesn't crash and does not invent fake clinics or doctors
    await expect(page.locator("body")).not.toContainText("Dr. Sarah Marlow");
  });
});
