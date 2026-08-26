import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Migrate/CLI need a direct (non-pooled) connection — Supabase's pooler
  // (pgbouncer) doesn't support the prepared statements migrations rely on.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
