#!/usr/bin/env node
// Verifies a simulated write persists: sign up, read balance, top up $50,
// confirm balance increased by $50 and a Top-up row appears.
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const email = `write+${Date.now()}@example.com`;
const password = "demo-pass-123";

const browser = await chromium.launch();
const page = await browser.newPage();
const fail = (m) => { console.error(`FAIL: ${m}`); process.exitCode = 1; };

await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL("**/home", { timeout: 25000 });
await page.waitForLoadState("networkidle");

const before = await page.textContent("p.text-2xl"); // "$1,240.00"
console.log(`balance before: ${before?.trim()}`);

// Ensure the number input is interactive (hydrated) before submitting, then
// verify the value actually took before clicking.
const amount = page.locator('input[name="amount"]');
await amount.waitFor({ state: "visible" });
await amount.fill("50");
await page.waitForFunction(
  () => document.querySelector('input[name="amount"]')?.value === "50",
  { timeout: 5000 },
);
await page.click('button:has-text("Top up")');

// Poll for the balance to reflect the write (server action + revalidate).
await page
  .waitForFunction(
    () => document.querySelector("p.text-2xl")?.textContent?.includes("1,290.00"),
    { timeout: 10000 },
  )
  .catch(() => {});
// Reload to confirm the write is durably persisted (not just optimistic UI).
await page.reload({ waitUntil: "networkidle" });

const after = await page.textContent("p.text-2xl");
console.log(`balance after:  ${after?.trim()}`);

if (after?.includes("1,290.00")) console.log("balance updated correctly (+$50)");
else fail(`expected $1,290.00, got ${after?.trim()}`);

const hasTopup = await page.locator('text=Top-up').first().isVisible().catch(() => false);
if (hasTopup) console.log("Top-up transaction row present");
else fail("Top-up transaction row not found");

await browser.close();
console.log(process.exitCode ? "\nRESULT: FAILED" : "\nRESULT: WRITE PERSISTED");
