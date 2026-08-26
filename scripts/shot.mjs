#!/usr/bin/env node
// Signs up a fresh user, then screenshots the given path at desktop + mobile.
// Usage: node scripts/shot.mjs <path> <name>
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = "http://localhost:3000";
const path = process.argv[2] ?? "/home";
const name = process.argv[3] ?? "page";
const email = `shot+${Date.now()}@example.com`;
const password = "demo-pass-123";

await mkdir("screenshots", { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));

// Sign up (also establishes the session cookie in this context).
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL("**/home", { timeout: 20000 }).catch(() => {});

// Desktop
await page.setViewportSize({ width: 1280, height: 900 });
const desktop = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
await page.screenshot({ path: `screenshots/${name}-desktop.png`, fullPage: true });

// Mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
await page.screenshot({ path: `screenshots/${name}-mobile.png`, fullPage: true });

await browser.close();
console.log(`status: ${desktop?.status()}`);
console.log(`account: ${email}`);
console.log(errors.length ? `console errors:\n  ${errors.join("\n  ")}` : "console errors: none");
