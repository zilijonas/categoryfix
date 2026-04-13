import { expect, test } from "@playwright/test";

test("merchants can review, apply, and roll back persisted findings", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/app");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.locator("[data-theme-toggle]").first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem("categoryfix-theme")),
    )
    .toBe("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await expect(page.getByRole("heading", { name: "Merchant review workspace" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Freshness status" })).toBeVisible();
  await expect(page.getByText(/Recent product webhook deliveries\s*0/)).toBeVisible();
  await page.getByRole("link", { name: "Open latest review" }).click();

  await expect(page.getByRole("heading", { name: "Future apply preview" })).toBeVisible();
  await expect(page.getByText(/Auto-rescan pending\s*No/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Apply changes" })).toBeVisible();

  await page.getByLabel("Confidence").selectOption("REVIEW_REQUIRED");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("Paperback Novel")).toBeVisible();

  await page
    .getByRole("row", { name: /Paperback Novel/ })
    .getByRole("link", { name: "Inspect basis" })
    .click();
  await expect(page.getByText("AI-assisted suggestion")).toBeVisible();
  await expect(
    page.getByText(
      "Suggested with assistive AI from limited product fields and local taxonomy candidates. Review before accepting.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Why CategoryFix suggested this")).toBeVisible();
  await page.getByRole("button", { name: "Accept suggestion" }).click();
  await expect(page.getByText(/Accepted for future apply\s*1/)).toBeVisible();
  await page.getByRole("link", { name: "Close" }).click();

  await page.getByRole("link", { name: "Reset" }).click();
  await page.getByRole("button", { name: "Accept all safe deterministic" }).click();
  await expect(page.getByText(/Accepted for future apply\s*3/)).toBeVisible();
  await expect(page.getByText(/Safe accepted by default\s*2/)).toBeVisible();

  await page.getByLabel("Confidence").selectOption("ALL");
  await page.getByLabel("Product title").fill("Mystery");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("row", { name: /Mystery Bundle/ })).toBeVisible();

  await page
    .getByRole("row", { name: /Mystery Bundle/ })
    .getByRole("link", { name: "Inspect basis" })
    .click();
  await page.getByRole("button", { name: "Dismiss suggestion" }).click();
  await expect(page.getByText(/Dismissed\s*1/)).toBeVisible();

  await page.reload();
  await page.getByLabel("Status").selectOption("DISMISSED");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("row", { name: /Mystery Bundle/ })).toBeVisible();

  await page.getByRole("link", { name: "Reset" }).click();
  await page.getByRole("button", { name: "Apply safe accepted" }).click();
  await expect(page.getByText("Latest apply job")).toBeVisible();
  await expect(page.getByText(/Applied\s*2 of 2/)).toBeVisible();
  await expect(page.getByText(/Already applied\s*2/)).toBeVisible();

  await page.getByRole("button", { name: "Rollback applied items" }).click();
  await expect(page.getByText("Latest rollback job")).toBeVisible();
  await expect(page.getByText(/Rolled back\s*2 of 2/)).toBeVisible();
  await expect(
    page
      .locator("section", {
        has: page.getByRole("heading", { name: "Future apply preview" }),
      })
      .getByText(/Rolled back\s*2/),
  ).toBeVisible();
  await expect(page.getByText("Audit timeline")).toBeVisible();
});
