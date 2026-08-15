import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// Postgres: Supabase (CLAUDE.md: Neon or Supabase). Use the pooled connection string from the
// Supabase dashboard (Project Settings -> Database -> Connection string -> "Transaction pooler",
// port 6543) — Vercel functions are short-lived, so pooling through Supavisor avoids exhausting
// Supabase's direct Postgres connection limit. Transaction-mode pooling doesn't support prepared
// statements, hence `prepare: false` (also correct, if unnecessary, against a direct connection).
const client = postgres(process.env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });

export { schema };
