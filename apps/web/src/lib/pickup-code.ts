/**
 * One-time pickup code generation (SPEC.md §10, LOG-05). Excludes visually ambiguous characters
 * (0/O, 1/I/L) since this is read aloud or compared by eye at a counter, not typed from a link.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

export function generatePickupCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
