import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("accepts a normal relative path", () => {
    expect(safeRedirectPath("/produto/bloco-ceramico-9x19x19")).toBe("/produto/bloco-ceramico-9x19x19");
  });

  it("accepts a relative path with a query string", () => {
    expect(safeRedirectPath("/catalogo?categoria=alvenaria")).toBe("/catalogo?categoria=alvenaria");
  });

  it("rejects null, empty, and non-string input", () => {
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath("")).toBeNull();
  });

  it("rejects protocol-relative URLs (open redirect)", () => {
    expect(safeRedirectPath("//evil.com")).toBeNull();
    expect(safeRedirectPath("///evil.com")).toBeNull();
  });

  it("rejects absolute URLs to another origin", () => {
    expect(safeRedirectPath("https://evil.com")).toBeNull();
    expect(safeRedirectPath("http://evil.com/produto/x")).toBeNull();
  });

  it("rejects paths without a leading slash", () => {
    expect(safeRedirectPath("produto/x")).toBeNull();
    expect(safeRedirectPath("evil.com")).toBeNull();
  });

  it("rejects control-character tricks used to smuggle a protocol-relative URL", () => {
    expect(safeRedirectPath("/\t/evil.com")).toBeNull();
    expect(safeRedirectPath("/\n/evil.com")).toBeNull();
    expect(safeRedirectPath("/\\evil.com")).toBeNull();
  });
});
