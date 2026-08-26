#!/usr/bin/env node
// Signs up one fresh (seeded) user, then screenshots every app page at desktop
// and mobile. Reports console errors per page.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = "http://localhost:3000";
const email = `all+${Date.now()}@example.com`;
const password = "demo-pass-123";
const pages = ["home", "transactions", "split", "rewards", "overseas", "bills", "budget"];

await mkdir("screenshots", { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(`[console] ${m.text()}`));
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL("**/home", { timeout: 25000 });
console.log(`signed up: ${email}`);

for (const p of pages) {
  await page.setViewportSize({ width: 1280, height: 900 });
  const res = await page.goto(`${BASE}/${p}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `screenshots/p2-${p}-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/${p}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `screenshots/p2-${p}-mobile.png`, fullPage: true });

  console.log(`${p}: ${res?.status()}`);
}

await browser.close();
console.log(errors.length ? `\nCONSOLE ERRORS:\n  ${errors.join("\n  ")}` : "\nconsole errors: none");
