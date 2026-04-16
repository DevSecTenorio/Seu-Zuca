import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, decoded.userId));

    if (!user) {
      res.status(401).json({ message: "Usuário não encontrado" });
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
