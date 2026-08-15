import "server-only";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

const PASSWORD_CHARS = {
  lower: "abcdefghjkmnpqrstuvwxyz",
  upper: "ABCDEFGHJKMNPQRSTUVWXYZ",
  digit: "23456789",
  // Excludes visually ambiguous characters (0/O, 1/l/I) — this password is only ever shown once
  // on screen for the admin to copy/relay, so typos matter more than entropy at this length.
};

/** Random password satisfying passwordSchema (lib/validation/auth.ts), for admin-issued
 * accounts (Criar Fornecedor, Usuários Internos, redefinir senha) — shown once, never stored
 * in plaintext or logged. */
export function generateRandomPassword(length = 12): string {
  const pools = Object.values(PASSWORD_CHARS);
  const all = pools.join("");
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  const pick = (pool: string, byte: number) => pool[byte % pool.length];

  // Guarantee at least one char from each required class, then fill the rest randomly.
  const required = pools.map((pool, i) => pick(pool, bytes[i]));
  const rest = Array.from({ length: length - pools.length }, (_, i) => pick(all, bytes[pools.length + i]));
  const combined = [...required, ...rest];

  // Fisher-Yates shuffle using the same random bytes so required chars aren't always up front.
  for (let i = combined.length - 1; i > 0; i--) {
    const j = bytes[i % bytes.length] % (i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join("");
}
