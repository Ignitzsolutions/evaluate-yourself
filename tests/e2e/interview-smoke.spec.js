const { expect, test } = require("@playwright/test");

test.describe("public pricing smoke", () => {
  test("routes pricing CTA to checkout", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText("Free Access Active")).toBeVisible();
    await page.getByRole("button", { name: "Start Career Sprint" }).click();
    await expect(page).toHaveURL(/\/checkout\/pro$/);
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  });
});
