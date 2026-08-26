import "dotenv/config";
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const t = await c.query(
  `select description, "amountCents" from "Transaction" where type='TOPUP' order by "createdAt" desc limit 3`,
);
console.log("TOPUP rows:", t.rowCount);
t.rows.forEach((r) => console.log("  ", r.description, r.amountCents));
const a = await c.query(
  `select substring("userId",1,12) uid, "balanceCents" from "Account" order by "updatedAt" desc limit 3`,
);
a.rows.forEach((r) => console.log("acct", r.uid, "bal", r.balanceCents));
await c.end();
