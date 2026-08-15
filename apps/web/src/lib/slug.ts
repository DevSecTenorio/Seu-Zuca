import "server-only";

/** ASCII-folds, lowercases and dashes a string into a URL-safe slug segment. */
export function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics left by NFD (á -> a + ´)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return base || "item";
}

/**
 * Generates a slug that doesn't collide, by appending -2, -3, ... until `exists` returns false.
 * Used for products and supplier companies, whose slugs power public URLs and are set once at
 * creation time — edits never regenerate them, so links stay stable.
 */
export async function generateUniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let suffix = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
