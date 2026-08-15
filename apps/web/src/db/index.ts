import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// WebSocket-based pool (as opposed to the neon-http driver used in src/lib/auth/session-core.ts)
// because this client needs real, multi-statement transactions — e.g. registration writes a
// user + company + address + KYC documents atomically. neon-http can't do that: each query is
// an independent HTTP call, so a later statement can't depend on an earlier one's result.
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });

export { schema };
