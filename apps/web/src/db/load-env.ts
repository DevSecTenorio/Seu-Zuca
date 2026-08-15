import { existsSync } from "node:fs";

// Side-effect-only module. Must be the FIRST import in any script run via `tsx` (e.g. seed.ts):
// ES module imports are hoisted and evaluated before any other top-level code in the importing
// file, so env vars need to be loaded by a module with no other imports of its own — otherwise
// "./index" (which reads DATABASE_URL at import time) would evaluate before .env.local is read.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}
