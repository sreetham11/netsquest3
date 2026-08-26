#!/usr/bin/env node
// Diagnostic only: deletes all splits for one test account, to screenshot the
// true empty Split state (ensureUserData always seeds two splits).
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

const splits = await c.query(`select id from "Split" where "ownerId" = $1`, [userId]);
for (const s of splits.rows) {
  await c.query(`delete from "SplitParticipant" where "splitId" = $1`, [s.id]);
  await c.query(`delete from "Split" where id = $1`, [s.id]);
}
console.log(`Deleted ${splits.rowCount} split(s) for ${email}`);
await c.end();
