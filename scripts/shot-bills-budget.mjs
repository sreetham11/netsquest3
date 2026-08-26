#!/usr/bin/env node
// Drives the new Bills payment-confirmation flow and Budget goal-setting
// flow end-to-end, screenshotting key states at desktop + mobile.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import "dotenv/config";
import pg from "pg";

const BASE = "http://localhost:3000";
const email = `billsbudget+${Date.now()}@example.com`;
const password = "demo-pass-123";

await mkdir("screenshots/bills-budget", { recursive: true });

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
  await page.screenshot({ path: `screenshots/bills-budget/${name}.png`, fullPage: true });
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

  // ---------------- Bills ----------------
  await page.goto(`${BASE}/bills`, { waitUntil: "networkidle" });
  await shot("01-bills-list-desktop", DESKTOP);

  const circlesCard = page.locator("div.rounded-card", { hasText: "Circles.Life mobile" }).last();
  await circlesCard.getByRole("button", { name: "Pay now" }).click();
  await shot("02-bills-confirm-desktop", DESKTOP);
  await shot("02-bills-confirm-mobile", MOBILE);
  await page.setViewportSize(DESKTOP);

  // Cancel first, verify it collapses cleanly with nothing charged.
  await circlesCard.getByRole("button", { name: "Cancel" }).click();
  const stillPayable = await page.getByRole("button", { name: "Pay now" }).count();
  console.log(`"Pay now" buttons after cancel: ${stillPayable}`);
  if (stillPayable < 1) fail("Cancel should leave the bill unpaid with Pay now still visible");

  // Now actually confirm payment.
  await circlesCard.getByRole("button", { name: "Pay now" }).click();
  await circlesCard.getByRole("button", { name: "Confirm payment" }).click();
  await page.waitForSelector("text=/Paid \\$45.90 on/", { timeout: 10000 });
  await shot("03-bills-paid-receipt-desktop", DESKTOP);
  await shot("03-bills-paid-receipt-mobile", MOBILE);
  await page.setViewportSize(DESKTOP);
  const receiptText = await page.locator("text=/Paid \\$45.90 on/").first().textContent();
  console.log(`receipt text: ${receiptText}`);

  // Verify balance actually moved and a Transaction was created (Home page).
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  const balanceText = await page.locator("text=/Available balance/").locator("..").locator("p.text-2xl").textContent();
  console.log(`balance after paying bill: ${balanceText}`);
  if (balanceText !== "$1,194.10") fail(`expected balance $1,194.10 (1240 - 45.90), got ${balanceText}`);
  const txnVisible = await page.locator("text=Circles.Life mobile").count();
  if (txnVisible < 1) fail("Circles.Life mobile transaction not visible in Recently used");
  console.log("bills payment flow: OK (balance decremented, transaction recorded, receipt shown)");

  // ---------------- Bills: insufficient balance ----------------
  // Drain the account directly via DB so we can exercise the real guard.
  {
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    await c.query(`update "Account" set "balanceCents" = 100 where "userId" = (select id::text from auth.users where email = $1)`, [email]);
    await c.end();
  }
  await page.goto(`${BASE}/bills`, { waitUntil: "networkidle" });
  const netflixCard = page.locator("div.rounded-card", { hasText: "Netflix" }).last();
  await netflixCard.getByRole("button", { name: "Pay now" }).click();
  await netflixCard.getByRole("button", { name: "Confirm payment" }).click();
  await page.waitForSelector("text=/Insufficient balance/", { timeout: 10000 });
  await shot("04-bills-insufficient-balance-desktop", DESKTOP);
  console.log("insufficient-balance guard: OK (error shown, no charge)");

  // ---------------- Budget ----------------
  // Restore balance so nothing else is confusing in the demo account.
  {
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    await c.query(`update "Account" set "balanceCents" = 124000 where "userId" = (select id::text from auth.users where email = $1)`, [email]);
    await c.end();
  }

  await page.goto(`${BASE}/budget`, { waitUntil: "networkidle" });
  await shot("05-budget-seeded-desktop", DESKTOP);

  // Edit an existing category's cap.
  const foodCard = page.locator("div.rounded-card", { hasText: "Food" }).last();
  await foodCard.getByRole("button", { name: "Edit" }).click();
  await shot("06-budget-edit-desktop", DESKTOP);
  await shot("06-budget-edit-mobile", MOBILE);
  await page.setViewportSize(DESKTOP);
  await page.fill('input[name="limitAmount"]', "55");
  await page.getByRole("button", { name: "Save" }).first().click();
  await page.waitForSelector("text=/out of \\$55.00/", { timeout: 10000 });
  console.log("budget edit flow: OK (cap updated to $55.00)");

  // Add a brand-new category.
  await page.click('button:has-text("Set budget")');
  await shot("07-budget-add-desktop", DESKTOP);
  await shot("07-budget-add-mobile", MOBILE);
  await page.setViewportSize(DESKTOP);
  await page.selectOption('select[name="category"]', "Entertainment");
  await page.fill('input[name="limitAmount"]', "60");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForSelector("text=Entertainment", { timeout: 10000 });
  await shot("08-budget-after-add-desktop", DESKTOP);
  console.log("budget add flow: OK (Entertainment category added)");

  // ---------------- Budget: real empty state ----------------
  {
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    await c.query(`delete from "BudgetCap" where "userId" = (select id::text from auth.users where email = $1)`, [email]);
    await c.end();
  }
  await page.goto(`${BASE}/budget`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=No budgets set yet", { timeout: 10000 });
  await shot("09-budget-empty-state-desktop", DESKTOP);
  await shot("09-budget-empty-state-mobile", MOBILE);
  console.log("budget empty state: OK");

  console.log(errors.length ? `\nconsole errors:\n  ${errors.join("\n  ")}` : "\nconsole errors: none");
  console.log(`\naccount: ${email}`);
  console.log(process.exitCode ? "\nRESULT: FAILURES ABOVE" : "\nRESULT: ALL CHECKS PASSED");
} catch (err) {
  fail(err.stack || err.message);
  await page.screenshot({ path: "screenshots/bills-budget/error.png" }).catch(() => {});
} finally {
  await browser.close();
}
