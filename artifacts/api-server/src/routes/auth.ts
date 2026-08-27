import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { signToken, authMiddleware, revokeToken, type AuthRequest } from "../middlewares/auth";
import { sendEmail, buildPasswordResetEmailHtml, buildVerificationEmailHtml } from "../lib/email";
import { writeAuditLog, getClientIp } from "../lib/auditLog";

const JWT_SECRET = process.env.SESSION_SECRET || "seu-zuca-secret-key";

// ── helpers de validação ────────────────────────────────────────────────────
function buildInsertUser(fields: {
  email: string; password: string; nome: string; role: "buyer" | "supplier";
  cnpj: string; razaoSocial?: string; nomeFantasia?: string; telefone?: string;
  ramo?: string; cep?: string; logradouro?: string; numero?: string;
  complemento?: string; bairro?: string; cidade?: string; estado?: string;
  documentos?: unknown; verificationHash: string; verificationExpiry: Date;
}) {
  return {
    email: fields.email,
    passwordHash: fields.password,
    nome: fields.nome,
    role: fields.role,
    status: "pending" as const,
    cnpj: fields.cnpj.replace(/\D/g, ""),
    razaoSocial: fields.razaoSocial,
    nomeFantasia: fields.nomeFantasia,
    telefone: fields.telefone,
    ramo: fields.ramo,
    cep: fields.cep,
    logradouro: fields.logradouro,
    numero: fields.numero,
    complemento: fields.complemento,
    bairro: fields.bairro,
    cidade: fields.cidade,
    estado: fields.estado,
    emailVerificado: false,
    emailVerificationToken: fields.verificationHash,
    emailVerificationExpiry: fields.verificationExpiry,
    documentos: fields.documentos ? JSON.stringify(fields.documentos) : null,
  };
}

const router: IRouter = Router();

function validateCnpj(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  const calcDigit = (digits: string, weights: number[]) => {
    const sum = digits.split("").reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const d1 = calcDigit(cleaned.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcDigit(cleaned.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return parseInt(cleaned[12]) === d1 && parseInt(cleaned[13]) === d2;
}

function generateToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

function getAppBaseUrl(): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domains) return `https://${domains}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.APP_BASE_URL || "http://localhost:80";
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  keyGenerator: (req) => {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded?.split(",")[0] ?? req.socket.remoteAddress ?? "unknown");
    return ip;
  },
  skip: () => process.env.NODE_ENV === "test",
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, nome, role, cnpj, razaoSocial, nomeFantasia, telefone, ramo, documentos } = req.body;

  if (!email || !password || !nome || !role) {
    res.status(400).json({ message: "Campos obrigatórios: email, senha, nome, papel" });
    return;
  }

  if (!["buyer", "supplier"].includes(role)) {
    res.status(400).json({ message: "Papel inválido" });
    return;
  }

  if (!cnpj || !validateCnpj(cnpj)) {
    res.status(400).json({ message: "CNPJ inválido" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ message: "E-mail já cadastrado" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { raw: verificationRaw, hash: verificationHash } = generateToken();
  const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [user] = await db.insert(usersTable).values(
    buildInsertUser({ email, password: passwordHash, nome, role, cnpj, razaoSocial, nomeFantasia, telefone, ramo, documentos, verificationHash, verificationExpiry })
  ).returning();

  const verificationUrl = `${getAppBaseUrl()}/verificar-email?token=${verificationRaw}&email=${encodeURIComponent(email)}`;
  await sendEmail({ to: email, subject: "Confirme seu e-mail — Seu Zuca", html: buildVerificationEmailHtml(nome, verificationUrl) }).catch(() => {});

  const token = signToken(user.id);
  res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax", secure: process.env.NODE_ENV === "production" });

  res.status(201).json({
    user: {
      id: user.id, email: user.email, nome: user.nome, role: user.role, status: user.status,
      cnpj: user.cnpj, razaoSocial: user.razaoSocial, nomeFantasia: user.nomeFantasia,
      telefone: user.telefone, emailVerificado: user.emailVerificado, createdAt: user.createdAt,
    },
    message: "Cadastro realizado. Confirme seu e-mail e aguarde aprovação do administrador.",
    requiresEmailVerification: true,
  });
});

// ── /auth/register/buyer ────────────────────────────────────────────────────
router.post("/auth/register/buyer", async (req, res): Promise<void> => {
  const { email, password, nome, cnpj, razaoSocial, nomeFantasia, telefone, ramo, cep, logradouro, numero, complemento, bairro, cidade, estado, documentos } = req.body;

  if (!email || !password || !nome || !cnpj || !razaoSocial) {
    res.status(400).json({ message: "Campos obrigatórios: email, senha, nome, CNPJ e razão social" });
    return;
  }
  if (!validateCnpj(cnpj)) {
    res.status(400).json({ message: "CNPJ inválido" });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ message: "E-mail já cadastrado" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { raw: verificationRaw, hash: verificationHash } = generateToken();
  const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [user] = await db.insert(usersTable).values(
    buildInsertUser({ email, password: passwordHash, nome, role: "buyer", cnpj, razaoSocial, nomeFantasia, telefone, ramo, cep, logradouro, numero, complemento, bairro, cidade, estado, documentos, verificationHash, verificationExpiry })
  ).returning();

  const verificationUrl = `${getAppBaseUrl()}/verificar-email?token=${verificationRaw}&email=${encodeURIComponent(email)}`;
  await sendEmail({ to: email, subject: "Confirme seu e-mail — Seu Zuca", html: buildVerificationEmailHtml(nome, verificationUrl) }).catch(() => {});

  const token = signToken(user.id);
  res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  res.status(201).json({
    user: { id: user.id, email: user.email, nome: user.nome, role: user.role, status: user.status, cnpj: user.cnpj, razaoSocial: user.razaoSocial, nomeFantasia: user.nomeFantasia, emailVerificado: user.emailVerificado, createdAt: user.createdAt },
    message: "Cadastro realizado. Confirme seu e-mail e aguarde aprovação do administrador.",
    requiresEmailVerification: true,
  });
});

// ── /auth/register/supplier ────────────────────────────────────────────────
router.post("/auth/register/supplier", async (req, res): Promise<void> => {
  const { email, password, nome, cnpj, razaoSocial, nomeFantasia, telefone, ramo, cep, logradouro, numero, complemento, bairro, cidade, estado, documentos } = req.body;

  if (!email || !password || !nome || !cnpj || !razaoSocial || !telefone) {
    res.status(400).json({ message: "Campos obrigatórios: email, senha, nome, CNPJ, razão social e telefone" });
    return;
  }
  if (!validateCnpj(cnpj)) {
    res.status(400).json({ message: "CNPJ inválido" });
    return;
  }
  const cartaoCnpjDoc = Array.isArray(documentos) && documentos.some((d: { tipo: string }) => d.tipo === "cartao_cnpj");
  if (!cartaoCnpjDoc) {
    res.status(400).json({ message: "Cartão CNPJ é obrigatório para fornecedores" });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ message: "E-mail já cadastrado" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { raw: verificationRaw, hash: verificationHash } = generateToken();
  const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [user] = await db.insert(usersTable).values(
    buildInsertUser({ email, password: passwordHash, nome, role: "supplier", cnpj, razaoSocial, nomeFantasia, telefone, ramo, cep, logradouro, numero, complemento, bairro, cidade, estado, documentos, verificationHash, verificationExpiry })
  ).returning();

  const verificationUrl = `${getAppBaseUrl()}/verificar-email?token=${verificationRaw}&email=${encodeURIComponent(email)}`;
  await sendEmail({ to: email, subject: "Confirme seu e-mail — Seu Zuca", html: buildVerificationEmailHtml(nome, verificationUrl) }).catch(() => {});

  const token = signToken(user.id);
  res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  res.status(201).json({
    user: { id: user.id, email: user.email, nome: user.nome, role: user.role, status: user.status, cnpj: user.cnpj, razaoSocial: user.razaoSocial, nomeFantasia: user.nomeFantasia, emailVerificado: user.emailVerificado, createdAt: user.createdAt },
    message: "Cadastro realizado. Confirme seu e-mail e aguarde aprovação do administrador.",
    requiresEmailVerification: true,
  });
});

router.post("/auth/login", loginLimiter, async (req, res): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: "E-mail e senha são obrigatórios" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ message: "E-mail ou senha incorretos" });
    return;
  }

  if (!user.emailVerificado) {
    res.status(403).json({
      message: "E-mail não verificado. Verifique sua caixa de entrada e clique no link de confirmação.",
      code: "EMAIL_NOT_VERIFIED",
    });
    return;
  }

  await db.update(usersTable).set({ ultimoAcesso: new Date() }).where(eq(usersTable.id, user.id));

  const token = signToken(user.id);
  res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax", secure: process.env.NODE_ENV === "production" });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role,
      status: user.status,
      cnpj: user.cnpj,
      razaoSocial: user.razaoSocial,
      nomeFantasia: user.nomeFantasia,
      stripeAccountId: user.stripeAccountId,
      emailVerificado: user.emailVerificado,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
    },
  });
});

router.post("/auth/logout", async (req: AuthRequest, res): Promise<void> => {
  const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    // Decode without verify to get expiration (already trusted from cookie)
    const decoded = jwt.decode(token) as { exp?: number } | null;
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await revokeToken(token, expiresAt);
    await writeAuditLog({
      actorId: req.userId,
      action: "user.logout",
      ip: getClientIp(req),
    });
  }
  res.clearCookie("token");
  res.json({ message: "Logout realizado com sucesso" });
});

router.get("/auth/me", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));

  if (!user) {
    res.status(404).json({ message: "Usuário não encontrado" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    nome: user.nome,
    role: user.role,
    status: user.status,
    cnpj: user.cnpj,
    razaoSocial: user.razaoSocial,
    nomeFantasia: user.nomeFantasia,
    telefone: user.telefone,
    ramo: user.ramo,
    stripeAccountId: user.stripeAccountId,
    emailVerificado: user.emailVerificado,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  });
});

router.put("/auth/profile", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { nome, telefone, nomeFantasia, razaoSocial } = req.body;
  const updates: Record<string, string> = {};
  if (nome) updates.nome = nome;
  if (telefone !== undefined) updates.telefone = telefone;
  if (nomeFantasia !== undefined) updates.nomeFantasia = nomeFantasia;
  if (razaoSocial !== undefined) updates.razaoSocial = razaoSocial;

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.userId!)).returning();
  if (!user) { res.status(404).json({ message: "Usuário não encontrado" }); return; }

  res.json({
    id: user.id, email: user.email, nome: user.nome, role: user.role, status: user.status,
    cnpj: user.cnpj, razaoSocial: user.razaoSocial, nomeFantasia: user.nomeFantasia,
    telefone: user.telefone, ramo: user.ramo, createdAt: user.createdAt,
  });
});

router.patch("/auth/change-password", authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ message: "Senha atual e nova senha são obrigatórias" }); return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ message: "Nova senha deve ter pelo menos 8 caracteres" }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) { res.status(404).json({ message: "Usuário não encontrado" }); return; }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) { res.status(401).json({ message: "Senha atual incorreta" }); return; }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash, mustChangePassword: false }).where(eq(usersTable.id, req.userId!));

  res.json({ message: "Senha alterada com sucesso" });
});

router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const { token, email } = req.body;

  if (!token || !email) {
    res.status(400).json({ message: "Token e e-mail são obrigatórios" });
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const [user] = await db.select().from(usersTable).where(
    and(
      eq(usersTable.email, email),
      eq(usersTable.emailVerificationToken, tokenHash),
      gt(usersTable.emailVerificationExpiry, new Date()),
    )
  );

  if (!user) {
    res.status(400).json({ message: "Link de verificação inválido ou expirado" });
    return;
  }

  if (user.emailVerificado) {
    res.json({ message: "E-mail já verificado anteriormente" });
    return;
  }

  await db.update(usersTable)
    .set({ emailVerificado: true, emailVerificationToken: null, emailVerificationExpiry: null })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "E-mail verificado com sucesso. Você já pode fazer login." });
});

router.post("/auth/resend-verification", async (req, res): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ message: "E-mail obrigatório" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user || user.emailVerificado) {
    res.json({ message: "Se o e-mail estiver cadastrado e não verificado, um novo link será enviado." });
    return;
  }

  const { raw, hash } = generateToken();
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.update(usersTable)
    .set({ emailVerificationToken: hash, emailVerificationExpiry: expiry })
    .where(eq(usersTable.id, user.id));

  const verificationUrl = `${getAppBaseUrl()}/verificar-email?token=${raw}&email=${encodeURIComponent(email)}`;

  await sendEmail({
    to: email,
    subject: "Confirme seu e-mail — Seu Zuca",
    html: buildVerificationEmailHtml(user.nome, verificationUrl),
  }).catch(() => {});

  res.json({ message: "Se o e-mail estiver cadastrado e não verificado, um novo link será enviado." });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ message: "E-mail obrigatório" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  res.json({ message: "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação." });

  if (!user) return;

  const { raw, hash } = generateToken();
  const expiry = new Date(Date.now() + 60 * 60 * 1000);

  await db.update(usersTable)
    .set({ resetToken: hash, resetTokenExpiry: expiry })
    .where(eq(usersTable.id, user.id));

  const resetUrl = `${getAppBaseUrl()}/redefinir-senha?token=${raw}&email=${encodeURIComponent(email)}`;

  await sendEmail({
    to: email,
    subject: "Recuperação de senha — Seu Zuca",
    html: buildPasswordResetEmailHtml(user.nome, resetUrl),
  }).catch(() => {});
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, email, password } = req.body;

  if (!token || !email || !password) {
    res.status(400).json({ message: "Token, e-mail e nova senha são obrigatórios" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ message: "A nova senha deve ter pelo menos 8 caracteres" });
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const [user] = await db.select().from(usersTable).where(
    and(
      eq(usersTable.email, email),
      eq(usersTable.resetToken, tokenHash),
      gt(usersTable.resetTokenExpiry, new Date()),
    )
  );

  if (!user) {
    res.status(400).json({ message: "Link de recuperação inválido ou expirado" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.update(usersTable)
    .set({ passwordHash, resetToken: null, resetTokenExpiry: null, mustChangePassword: false })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "Senha redefinida com sucesso. Você já pode fazer login." });
});

export default router;
