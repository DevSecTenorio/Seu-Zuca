import { Request, Response, NextFunction } from "express";
import validator from "validator";

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    // Trim whitespace and escape HTML special characters to prevent XSS
    return validator.escape(validator.trim(value));
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    // Sanitize keys too (prevent prototype pollution)
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    result[key] = sanitizeValue(obj[key]);
  }
  return result;
}

// Fields that should NOT be HTML-escaped (URLs, JSON content, passwords, etc.)
const RAW_FIELDS = new Set([
  "password", "passwordHash", "confirmPassword",
  "url", "imagemPrincipal", "uploadURL", "objectPath",
  "descricao",  // descriptions may contain brackets/quotes
  "documentos", "metadata", "details", "regioesAtendidas",
]);

function selectiveSanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const value = obj[key];
    if (RAW_FIELDS.has(key)) {
      // Only trim strings in raw fields, don't escape
      result[key] = typeof value === "string" ? validator.trim(value) : value;
    } else if (Array.isArray(value)) {
      result[key] = value.map((v) =>
        typeof v === "string" ? validator.trim(v) : v,
      );
    } else if (typeof value === "string") {
      result[key] = validator.trim(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function sanitizeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    req.body = selectiveSanitize(req.body as Record<string, unknown>);
  }
  next();
}
