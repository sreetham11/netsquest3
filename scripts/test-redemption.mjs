#!/usr/bin/env node
// Full redemption flow: signup (seeded account) -> screenshot Rewards ->
// redeem a Coffee -> assert points deducted + confirmation row appears ->
// reload -> assert it persisted (real DB row, not client state).
import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = "http://localhost:3000";
const email = `redeem+${Date.now()}@example.com`;
const password = "demo-pass-123";

await mkdir("screenshots", { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(`[console] ${m.text()}`));
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};

const pointsLocator = page.locator("text=Your points").locator("..").locator("p.text-2xl");
const readPoints = async () => Number((await pointsLocator.textContent()).replace(/,/g, ""));

await page.setViewportSize({ width: 1280, height: 900 });

// 1. Sign up (seeds a fresh account with realistic points).
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL("**/home", { timeout: 25000 });
console.log(`signed up: ${email}`);

// 2. Go to Rewards, capture starting points.
await page.goto(`${BASE}/rewards`, { waitUntil: "networkidle" });
await page.screenshot({ path: "screenshots/redeem-1-before.png", fullPage: true });

const pointsBefore = await readPoints();
console.log(`points before: ${pointsBefore}`);

// 3. Redeem the Coffee (500 pts) — locate its card by name, then its form button.
const coffeeCard = page.locator("text=Coffee").first().locator("../..");
const redeemButton = coffeeCard.getByRole("button", { name: "Redeem" });
const isDisabled = await redeemButton.isDisabled();
console.log(`Coffee redeem button disabled: ${isDisabled}`);
if (isDisabled) {
  fail("Coffee redeem button was disabled — seed points too low to test redemption");
} else {
  await redeemButton.click();

  // Server action -> revalidatePath -> RSC refresh is async; wait for the
  // actual DOM change rather than trusting network-idle timing.
  await expect(pointsLocator).toHaveText((pointsBefore - 500).toLocaleString(), { timeout: 10000 });
  const pointsAfter = await readPoints();
  console.log(`points after: ${pointsAfter}`);
  console.log("points deducted correctly: OK");

  await page.screenshot({ path: "screenshots/redeem-2-after.png", fullPage: true });

  const recentSection = page.locator("h2", { hasText: "Recently redeemed" }).locator("..");
  await expect(recentSection.getByText("Coffee").first()).toBeVisible({ timeout: 10000 });
  console.log("confirmation row visible: OK");

  // 4. Reload — confirm it's a persisted DB write, not just client state.
  await page.reload({ waitUntil: "networkidle" });
  await page.screenshot({ path: "screenshots/redeem-3-after-reload.png", fullPage: true });

  const pointsAfterReload = await readPoints();
  console.log(`points after reload: ${pointsAfterReload}`);
  if (pointsAfterReload !== pointsBefore - 500) {
    fail(`points did NOT persist across reload (expected ${pointsBefore - 500}, got ${pointsAfterReload})`);
  } else {
    console.log("persistence across reload: OK");
  }

  const recentSectionAfterReload = page.locator("h2", { hasText: "Recently redeemed" }).locator("..");
  const persistedVisible = await recentSectionAfterReload
    .getByText("Coffee")
    .first()
    .isVisible()
    .catch(() => false);
  if (!persistedVisible) {
    fail("Coffee redemption row did NOT persist in Recently redeemed after reload");
  } else {
    console.log("redemption row persisted after reload: OK");
  }
}

await browser.close();
console.log(`\naccount: ${email}`);
console.log(errors.length ? `\nCONSOLE ERRORS:\n  ${errors.join("\n  ")}` : "\nconsole errors: none");
console.log(process.exitCode ? "\nRESULT: FAILURES ABOVE" : "\nRESULT: ALL CHECKS PASSED");
