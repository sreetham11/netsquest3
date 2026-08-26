#!/usr/bin/env node
// Drives the Split "Scan receipt" flow end-to-end (demo path + graceful
// failure path) and screenshots the key states at desktop + mobile.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = "http://localhost:3000";
const email = `receiptscan+${Date.now()}@example.com`;
const password = "demo-pass-123";

await mkdir("screenshots/receipt-scan", { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};

async function shot(name, viewport) {
  await page.setViewportSize(viewport);
  await page.screenshot({ path: `screenshots/receipt-scan/${name}.png`, fullPage: true });
}

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

try {
  await page.setViewportSize(DESKTOP);
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/home", { timeout: 20000 }).catch(() => {});

  await page.goto(`${BASE}/split`, { waitUntil: "networkidle" });
  await page.click('button:has-text("New split")');
  await page.waitForSelector('text="New split"');
  await shot("01-manual-default-desktop", DESKTOP);

  // Switch to Scan receipt tab.
  await page.click('button:has-text("Scan receipt")');
  await shot("02-scan-options-desktop", DESKTOP);
  await shot("02-scan-options-mobile", MOBILE);
  await page.setViewportSize(DESKTOP);

  // Demo receipt path.
  await page.click('button:has-text("Try demo receipt")');
  await page.waitForSelector('input[value="Chicken Rice"]');
  await shot("03-scan-review-desktop", DESKTOP);
  await shot("03-scan-review-mobile", MOBILE);
  await page.setViewportSize(DESKTOP);

  // Edit one item's price, remove another, to prove editable/removable works.
  const items = await page.locator('input[placeholder="Item name"]').all();
  console.log(`demo items found: ${items.length}`);
  if (items.length !== 5) fail(`expected 5 demo items, found ${items.length}`);

  // Remove the last item (Fried Carrot Cake) via its remove (x) button.
  const removeButtons = await page.locator('button[aria-label^="Remove "]').all();
  await removeButtons[removeButtons.length - 1].click();
  await shot("04-scan-review-after-remove-desktop", DESKTOP);

  const itemsAfterRemove = await page.locator('input[placeholder="Item name"]').count();
  if (itemsAfterRemove !== 4) fail(`expected 4 items after remove, found ${itemsAfterRemove}`);

  // Confirm with the (now stale, still-editable) total — adjust it down to match.
  const totalInput = page.locator('label:has-text("Total amount") input[type="number"]');
  await totalInput.fill("13.30");
  await page.click('button:has-text("Looks good, continue")');
  await page.waitForSelector('text=/items scanned/');
  await shot("05-scan-confirmed-desktop", DESKTOP);
  await shot("05-scan-confirmed-mobile", MOBILE);
  await page.setViewportSize(DESKTOP);

  const confirmedText = await page.locator('text=/items scanned/').textContent();
  console.log(`confirmed summary: ${confirmedText}`);

  // Add a second participant, switch to custom split briefly, back to equal.
  await page.fill('input[placeholder="Type a name, press Enter"]', "Alex");
  await page.press('input[placeholder="Type a name, press Enter"]', "Enter");
  await shot("06-who-splitting-desktop", DESKTOP);

  await page.fill('input[name="title"]', "Hawker centre lunch");
  await shot("07-ready-to-submit-desktop", DESKTOP);

  await page.click('button:has-text("Create split")');
  await page.waitForSelector('text="Hawker centre lunch"', { timeout: 10000 });
  await shot("08-split-created-desktop", DESKTOP);
  console.log("demo-receipt flow: split created successfully");

  // --- Graceful-failure path: real upload with no ANTHROPIC_API_KEY set ---
  await page.click('button:has-text("New split")');
  await page.click('button:has-text("Scan receipt")');
  const buf = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAI0lEQVR4nO3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAA4NcAECAAAWpTgSUAAAAASUVORK5CYII=",
    "base64",
  );
  await page.setInputFiles('input[type="file"]:not([capture])', {
    name: "test-receipt.png",
    mimeType: "image/png",
    buffer: buf,
  });
  await page.waitForSelector('text=/Try again/', { timeout: 15000 });
  await shot("09-scan-error-desktop", DESKTOP);
  await shot("09-scan-error-mobile", MOBILE);
  await page.setViewportSize(DESKTOP);
  const errorText = await page.locator("p.text-danger-strong").first().textContent();
  console.log(`error state message: ${errorText}`);

  // Recover via "Enter manually instead" — title typed earlier should be gone
  // (this is a fresh "New split" open), but manual form should render cleanly.
  await page.click('button:has-text("Enter manually instead")');
  await page.waitForSelector('input[name="totalAmount"]');
  await shot("10-recovered-manual-desktop", DESKTOP);
  console.log("graceful-failure -> manual fallback: OK");

  console.log(errors.length ? `\nconsole errors:\n  ${errors.join("\n  ")}` : "\nconsole errors: none");
  console.log(`\naccount: ${email}`);
  console.log(process.exitCode ? "\nRESULT: FAILURES ABOVE" : "\nRESULT: ALL CHECKS PASSED");
} catch (err) {
  fail(err.stack || err.message);
  await page.screenshot({ path: "screenshots/receipt-scan/error.png" }).catch(() => {});
} finally {
  await browser.close();
}
