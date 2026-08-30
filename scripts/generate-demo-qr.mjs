#!/usr/bin/env node
// Dev-only tool: generates real, scannable PNG QR codes for the Pay flow's
// demo merchants, to print or display on a second phone/screen during a demo
// of ScanPay.tsx's live camera scanning. NOT part of the shipped app — no
// route reads this, nothing imports it, it just writes files to disk.
//
// Encodes the exact payload format ScanPay.tsx/parseNetsQrPayload expects —
// see src/lib/qrPayload.ts. Amounts for FairPrice/Kopitiam match the
// existing /preview mock transaction data; Cheers/Toast Box are new,
// plausible demo amounts (no existing precedent to match).
//
// Usage: npm run generate:demo-qr
import QRCode from "qrcode";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = "demo-qr-codes";

const DEMO_MERCHANTS = [
  { merchant: "FairPrice", category: "Groceries", amountCents: 2360 },
  { merchant: "Kopitiam", category: "Food", amountCents: 840 },
  { merchant: "Cheers", category: "Shopping", amountCents: 690 },
  { merchant: "Toast Box", category: "Food", amountCents: 520 },
];

await mkdir(OUTPUT_DIR, { recursive: true });

for (const demo of DEMO_MERCHANTS) {
  const payload = JSON.stringify(demo);
  const fileName = `${demo.merchant.toLowerCase().replace(/\s+/g, "-")}.png`;
  const outputPath = path.join(OUTPUT_DIR, fileName);
  await QRCode.toFile(outputPath, payload, { width: 512, margin: 2 });
  console.log(`${outputPath}  ->  ${payload}`);
}

console.log(`\n${DEMO_MERCHANTS.length} demo QR codes written to ${OUTPUT_DIR}/`);
