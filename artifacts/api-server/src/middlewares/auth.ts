import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const JWT_SECRET = process.env.SESSION_SECRET || "seu-zuca-secret-key";

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  userStatus?: string;
}

export function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Clean expired tokens at most once per hour (fire-and-forget)
let lastCleanup = 0;
async function maybeCleanExpiredTokens(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanup < 60 * 60 * 1000) return;
  lastCleanup = now;
  try {
    await db.execute(sql`DELETE FROM revoked_tokens WHERE expires_at < NOW()`);
  } catch (err) {
    logger.warn({ err }, "Failed to clean expired revoked tokens");
  }
}

async function isTokenRevoked(token: string): Promise<boolean> {
  try {
    const hash = hashToken(token);
    const result = await db.execute(
      sql`SELECT 1 FROM revoked_tokens WHERE token_hash = ${hash} AND expires_at > NOW() LIMIT 1`,
    );
    return result.rows.length > 0;
  } catch (err) {
    logger.warn({ err }, "Failed to check token blacklist — allowing request");
    return false;
  }
}

export async function revokeToken(token: string, expiresAt: Date): Promise<void> {
  const hash = hashToken(token);
  try {
    await db.execute(
      sql`INSERT INTO revoked_tokens (token_hash, expires_at) VALUES (${hash}, ${expiresAt.toISOString()}) ON CONFLICT DO NOTHING`,
    );
  } catch (err) {
    logger.warn({ err }, "Failed to revoke token");
  }
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    res.status(401).json({ message: "Não autenticado" });
    return;
  }

  // Fire-and-forget cleanup of expired revoked tokens
  void maybeCleanExpiredTokens();

  const revoked = await isTokenRevoked(token);
  if (revoked) {
    res.status(401).json({ message: "Sessão encerrada. Faça login novamente." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, decoded.userId));

    if (!user) {
      res.status(401).json({ message: "Usuário não encontrado" });
      return;
    }

    if (user.status === "suspended") {
      res.status(403).json({ message: "Conta suspensa. Contate o suporte." });
      return;
    }

    req.userId = user.id;
    req.userRole = user.role;
    req.userStatus = user.status;
    next();
  } catch (err) {
    logger.warn({ err }, "Token inválido");
    res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== "admin") {
    res.status(403).json({ message: "Acesso restrito a administradores" });
    return;
  }
  next();
}

export function requireAdminOrSupport(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== "admin" && req.userRole !== "support") {
    res.status(403).json({ message: "Acesso restrito a administradores e suporte" });
    return;
  }
  next();
}

export function requireSupplier(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== "supplier" && req.userRole !== "admin") {
    res.status(403).json({ message: "Acesso restrito a fornecedores" });
    return;
  }
  next();
}

export function requireApprovedBuyer(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== "buyer" && req.userRole !== "admin") {
    res.status(403).json({ message: "Acesso restrito a compradores" });
    return;
  }
  if (req.userStatus !== "approved" && req.userRole !== "admin") {
    res.status(403).json({ message: "Conta aguardando aprovação do administrador" });
    return;
  }
  next();
}
