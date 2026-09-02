#!/usr/bin/env node
// Diagnostic/demo helper: adds a few small transactions in Food, Transport,
// and Groceries categories to a given account, so the Home donut chart has
// more than one category to render (and the multi-color fix is actually
// visible, not just present in code). Temporary/test data only — safe to
// delete afterward via scripts/wipe-*-style cleanup or just leave, it's the
// same kind of demo data ensureUserData already seeds at signup.
//
// Usage: node scripts/seed-category-spend.mjs you@example.com
import "dotenv/config";
import pg from "pg";
import { randomUUID } from "node:crypto";

const [, , email] = process.argv;
if (!email) {
  console.log("Usage: node scripts/seed-category-spend.mjs you@example.com");
  process.exit(1);
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const userRes = await c.query(`select id from auth.users where email = $1`, [email.toLowerCase()]);
if (userRes.rowCount === 0) {
  console.log(`No auth user with email ${email}`);
  await c.end();
  process.exit(1);
}
const userId = userRes.rows[0].id;

const EXTRA_SPEND = [
  { description: "Grab ride", category: "Transport", amountCents: -1250 },
  { description: "Toast Box", category: "Food", amountCents: -680 },
  { description: "Sheng Siong", category: "Groceries", amountCents: -3420 },
];

for (const t of EXTRA_SPEND) {
  await c.query(
    `insert into "Transaction" (id, "userId", description, category, "amountCents", type, "createdAt")
     values ($1, $2, $3, $4, $5, 'PAYMENT', now())`,
    [randomUUID(), userId, t.description, t.category, t.amountCents],
  );
}

console.log(`Added ${EXTRA_SPEND.length} transactions for ${email}:`);
for (const t of EXTRA_SPEND) console.log(`  ${t.category.padEnd(10)} ${t.description} (${(t.amountCents / -100).toFixed(2)})`);

await c.end();
