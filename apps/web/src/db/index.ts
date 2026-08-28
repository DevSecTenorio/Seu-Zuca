import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let lazyDb: Db | undefined;

// Connecting lazily (on first query, not on import) keeps DATABASE_URL out of the module
// evaluation path Next.js walks when collecting page data at build time — Vercel's Sensitive
// environment variables are only injected at runtime, so touching process.env at module scope
// here would fail the build for a variable no build step actually needs.
function getDb(): Db {
  if (!lazyDb) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
    }

    // Postgres: Supabase (CLAUDE.md: Neon or Supabase). Use the pooled connection string from
    // the Supabase dashboard (Project Settings -> Database -> Connection string -> "Transaction
    // pooler", port 6543) — Vercel functions are short-lived, so pooling through Supavisor avoids
    // exhausting Supabase's direct Postgres connection limit. Transaction-mode pooling doesn't
    // support prepared statements, hence `prepare: false` (also correct, if unnecessary, against
    // a direct connection).
    const client = postgres(process.env.DATABASE_URL, { prepare: false });
    lazyDb = drizzle(client, { schema });
  }
  return lazyDb;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

export { schema };
