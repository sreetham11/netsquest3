#!/usr/bin/env node
// Screenshots the Rewards page at desktop + mobile, fresh (unredeemed) state.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = "http://localhost:3000";
const email = `rewardsview+${Date.now()}@example.com`;
const password = "demo-pass-123";

await mkdir("screenshots", { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL("**/home", { timeout: 25000 });

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${BASE}/rewards`, { waitUntil: "networkidle" });
await page.screenshot({ path: "screenshots/rewards-final-desktop.png", fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/rewards`, { waitUntil: "networkidle" });
await page.screenshot({ path: "screenshots/rewards-final-mobile.png", fullPage: true });

await browser.close();
console.log(`account: ${email}`);
console.log("done");
