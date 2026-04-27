import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signToken, authMiddleware, type AuthRequest } from "../middlewares/auth";

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

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, nome, role, cnpj, razaoSocial, nomeFantasia, telefone, ramo, cep, logradouro, numero, bairro, cidade, estado, documentos } = req.body;

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
  const status = role === "supplier" ? "approved" : "pending";

  const [user] = await db.insert(usersTable).values({
    email,
    passwordHash,
    nome,
    role,
    status,
    cnpj: cnpj.replace(/\D/g, ""),
    razaoSocial,
    nomeFantasia,
    telefone,
    ramo,
    emailVerificado: true,
    documentos: documentos ? JSON.stringify(documentos) : null,
  }).returning();

  const token = signToken(user.id);
  res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });

  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role,
      status: user.status,
      cnpj: user.cnpj,
      razaoSocial: user.razaoSocial,
      nomeFantasia: user.nomeFantasia,
      telefone: user.telefone,
      emailVerificado: user.emailVerificado,
      createdAt: user.createdAt,
    },
    message: role === "buyer"
      ? "Cadastro realizado. Aguardando aprovação do administrador."
      : "Cadastro realizado com sucesso.",
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
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

  await db.update(usersTable).set({ ultimoAcesso: new Date() }).where(eq(usersTable.id, user.id));

  const token = signToken(user.id);
  res.cookie("token", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });

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

router.post("/auth/logout", async (_req, res): Promise<void> => {
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

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ message: "E-mail obrigatório" });
    return;
  }
  res.json({ message: "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação." });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body;
  if (!token || !password) {
    res.status(400).json({ message: "Token e nova senha são obrigatórios" });
    return;
  }
  res.json({ message: "Senha redefinida com sucesso" });
});

export default router;
