#!/usr/bin/env node
// Diagnostic only: overwrites one test account's spend so all 3 budget risk
// tiers (under 70%, 70-99%, 100%+) are visible in a single screenshot.
// Does this by inserting extra PAYMENT transactions this month per category.
import "dotenv/config";
import pg from "pg";

const [, , email] = process.argv;
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const userRes = await c.query(`select id from auth.users where email = $1`, [email.toLowerCase()]);
if (userRes.rowCount === 0) {
  console.log(`No auth user with email ${email}`);
  process.exit(1);
}
const userId = userRes.rows[0].id;

// Caps from seed: Food 30000, Transport 15000, Shopping 40000, Groceries 35000 (cents)
// Target: Food ~40% (under), Groceries ~85% (approaching), Shopping ~120% (over), Transport untouched.
const topUps = [
  { category: "Food", target: 12000, cap: 30000 },
  { category: "Groceries", target: 29750, cap: 35000 },
  { category: "Shopping", target: 48000, cap: 40000 },
];

for (const t of topUps) {
  const spentRes = await c.query(
    `select coalesce(sum("amountCents"),0) as spent from "Transaction"
     where "userId" = $1 and category = $2 and "amountCents" < 0
       and "createdAt" >= date_trunc('month', now())`,
    [userId, t.category],
  );
  const currentSpent = Math.abs(Number(spentRes.rows[0].spent));
  const delta = t.target - currentSpent;
  if (delta > 0) {
    await c.query(
      `insert into "Transaction" (id, "userId", description, category, "amountCents", type, "createdAt")
       values (gen_random_uuid()::text, $1, $2, $3, $4, 'PAYMENT', now())`,
      [userId, `${t.category} top-up (test)`, t.category, -delta],
    );
  }
  console.log(`${t.category}: was ${currentSpent}, now ~${t.target} of ${t.cap} cap (${Math.round((t.target / t.cap) * 100)}%)`);
}

await c.end();
