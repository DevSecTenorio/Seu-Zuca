import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Paths exempt from CSRF (webhooks from payment providers, public registration)
const CSRF_EXEMPT_PATHS = new Set([
  "/api/payments/webhook",
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/verify-email",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
]);

function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Attach CSRF token to every response as a readable cookie (not httpOnly)
  // so the SPA can pick it up with document.cookie / js-cookie
  let csrfToken = req.cookies?.["csrf-token"] as string | undefined;
  if (!csrfToken) {
    csrfToken = generateCsrfToken();
    res.cookie("csrf-token", csrfToken, {
      httpOnly: false,     // must be readable by JS
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 h
    });
  }

  // Skip verification for safe methods and exempt paths
  if (!MUTATION_METHODS.has(req.method) || CSRF_EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  const headerToken = req.headers["x-csrf-token"] as string | undefined;

  // In development mode, be lenient to not block Postman / curl during dev
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  if (!headerToken || headerToken !== csrfToken) {
    res.status(403).json({ message: "Token CSRF inválido ou ausente" });
    return;
  }

  next();
}
