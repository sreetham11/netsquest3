#!/usr/bin/env node
// Visual verification helper: loads a URL in a real headless browser and saves a screenshot.
// Usage: node scripts/screenshot.mjs [url] [outputPath]
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const url = process.argv[2] ?? "http://localhost:3000";
const outputPath = process.argv[3] ?? "screenshots/latest.png";

await mkdir(path.dirname(outputPath), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(err.message));

const response = await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: outputPath, fullPage: true });

await browser.close();

console.log(`status: ${response?.status() ?? "no response"}`);
console.log(`screenshot: ${outputPath}`);
if (consoleErrors.length) {
  console.log("console errors:");
  for (const e of consoleErrors) console.log(`  - ${e}`);
} else {
  console.log("console errors: none");
}
