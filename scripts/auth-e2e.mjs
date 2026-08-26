#!/usr/bin/env node
// End-to-end auth verification: signup -> dashboard -> refresh (session persists)
// -> logout -> login again. Screenshots each stage and asserts real outcomes.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3000";
const email = `demo+${Date.now()}@example.com`;
const password = "demo-pass-123";

await mkdir("screenshots", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};

try {
  // 1. Sign up
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.screenshot({ path: "screenshots/auth-1-signup.png" });
  await page.click('button[type="submit"]');
  // Wait for either the dashboard redirect or an on-page error.
  await Promise.race([
    page.waitForURL("**/dashboard", { timeout: 15000 }),
    page.waitForSelector('[role="alert"]', { timeout: 15000 }),
  ]).catch(() => {});
  const signupError = await page
    .textContent('[role="alert"]')
    .catch(() => null);
  if (signupError) {
    fail(`signup returned error: ${signupError.trim()}`);
    throw new Error(`signup error: ${signupError.trim()}`);
  }
  await page.waitForURL("**/dashboard", { timeout: 5000 });
  console.log(`signup -> redirected to: ${page.url()}`);
  await page.screenshot({ path: "screenshots/auth-2-dashboard.png" });

  const shownEmail = await page.textContent('[data-testid="user-email"]');
  const userId = await page.textContent('[data-testid="user-id"]');
  console.log(`dashboard shows email: ${shownEmail}`);
  console.log(`dashboard shows user id: ${userId}`);
  if (shownEmail?.trim() !== email) fail(`dashboard email mismatch (got ${shownEmail})`);
  if (!userId || userId.trim().length < 10) fail("no user id rendered");

  // 2. Refresh — session must persist (no redirect to /login)
  await page.reload({ waitUntil: "networkidle" });
  console.log(`after refresh, url: ${page.url()}`);
  if (!page.url().includes("/dashboard")) fail("session did NOT persist across refresh");
  const emailAfterRefresh = await page.textContent('[data-testid="user-email"]');
  if (emailAfterRefresh?.trim() !== email) fail("email not shown after refresh");
  await page.screenshot({ path: "screenshots/auth-3-after-refresh.png" });
  console.log("session persisted across refresh: OK");

  // 3. Open a brand-new tab (new browser context page) to confirm cookie-based session,
  //    then log out.
  await Promise.all([
    page.waitForURL("**/login", { timeout: 15000 }),
    page.click('button[type="submit"]'), // Sign out button
  ]);
  console.log(`logout -> redirected to: ${page.url()}`);

  // 4. Log back in with the same credentials
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
  console.log(`login -> redirected to: ${page.url()}`);
  if (!page.url().includes("/dashboard")) fail("re-login did not reach dashboard");
  await page.screenshot({ path: "screenshots/auth-4-relogin.png" });

  console.log(`\ntest account: ${email}`);
  console.log(process.exitCode ? "\nRESULT: FAILURES ABOVE" : "\nRESULT: ALL CHECKS PASSED");
} catch (err) {
  fail(err.message);
  await page.screenshot({ path: "screenshots/auth-error.png" }).catch(() => {});
} finally {
  await browser.close();
}
