"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/require-user";
import { hashPassword, generateRandomPassword } from "@/lib/auth/password";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email";
import { generateUniqueSlug } from "@/lib/slug";
import { onlyDigits, isValidCnpj } from "@/lib/cnpj";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import type { FormState } from "./form-state";

function revalidateUserSurfaces() {
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/usuarios-internos");
  revalidatePath("/admin");
  revalidatePath("/suporte");
}

export async function approveUserAction(userId: string) {
  const admin = await requireUser(["admin"]);
  const before = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!before || before.status !== "pendente") return;

  await db
    .update(schema.users)
    .set({ status: "aprovado", rejectionReason: null, updatedAt: new Date() })
    .where(eq(schema.users.id, userId));

  await logAudit({ actorId: admin.id, action: "user.approve", entityType: "user", entityId: userId, before });
  await sendEmail({
    to: before.email,
    subject: "Cadastro aprovado — Seu Zuca",
    html: `<p>Boas notícias! Seu cadastro no Seu Zuca foi aprovado.</p>
           <p>Você já pode entrar na plataforma: <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login">acessar minha conta</a>.</p>`,
  });
  revalidateUserSurfaces();
}

export async function rejectUserAction(userId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireUser(["admin"]);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { status: "error", fieldErrors: { reason: ["Informe o motivo da rejeição."] } };

  const before = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!before) return { status: "error", message: "Usuário não encontrado." };

  await db
    .update(schema.users)
    .set({ status: "rejeitado", rejectionReason: reason, updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
  await destroyAllSessionsForUser(userId);

  await logAudit({ actorId: admin.id, action: "user.reject", entityType: "user", entityId: userId, before, after: { reason } });
  await sendEmail({
    to: before.email,
    subject: "Cadastro não aprovado — Seu Zuca",
    html: `<p>Analisamos seu cadastro no Seu Zuca e, neste momento, não foi possível aprová-lo.</p>
           <p><strong>Motivo:</strong> ${reason}</p>
           <p>Se quiser mais informações, entre em contato com nosso suporte.</p>`,
  });
  revalidateUserSurfaces();
  return { status: "success", message: "Cadastro rejeitado." };
}

export async function suspendUserAction(userId: string) {
  const admin = await requireUser(["admin"]);
  const before = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!before || before.status !== "aprovado") return;

  await db.update(schema.users).set({ status: "suspenso", updatedAt: new Date() }).where(eq(schema.users.id, userId));
  await destroyAllSessionsForUser(userId);

  await logAudit({ actorId: admin.id, action: "user.suspend", entityType: "user", entityId: userId, before });
  revalidateUserSurfaces();
}

export async function reactivateUserAction(userId: string) {
  const admin = await requireUser(["admin"]);
  const before = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!before || before.status !== "suspenso") return;

  await db.update(schema.users).set({ status: "aprovado", updatedAt: new Date() }).where(eq(schema.users.id, userId));

  await logAudit({ actorId: admin.id, action: "user.reactivate", entityType: "user", entityId: userId, before });
  revalidateUserSurfaces();
}

export async function adminResetPasswordAction(userId: string): Promise<FormState> {
  const admin = await requireUser(["admin"]);
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user) return { status: "error", message: "Usuário não encontrado." };

  const newPassword = generateRandomPassword();
  const passwordHash = await hashPassword(newPassword);
  await db.update(schema.users).set({ passwordHash, updatedAt: new Date() }).where(eq(schema.users.id, userId));
  await destroyAllSessionsForUser(userId);

  await logAudit({ actorId: admin.id, action: "user.reset_password", entityType: "user", entityId: userId });
  revalidateUserSurfaces();
  return { status: "success", generatedPassword: newPassword };
}

const createSupplierSchema = z.object({
  razaoSocial: z.string().trim().min(2, "Informe a razão social"),
  nomeFantasia: z.string().trim().min(2, "Informe o nome fantasia"),
  cnpj: z.string().trim().refine(isValidCnpj, "CNPJ inválido"),
  email: z.string().trim().email("E-mail inválido"),
  telefone: z.string().trim().min(8, "Informe um telefone válido"),
  ramoAtividade: z.string().trim().min(2, "Informe o ramo de atividade"),
});

export async function createSupplierAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireUser(["admin"]);
  const parsed = createSupplierSchema.safeParse({
    razaoSocial: formData.get("razaoSocial"),
    nomeFantasia: formData.get("nomeFantasia"),
    cnpj: formData.get("cnpj"),
    email: formData.get("email"),
    telefone: formData.get("telefone"),
    ramoAtividade: formData.get("ramoAtividade"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;
  const email = data.email.toLowerCase();
  const cnpj = onlyDigits(data.cnpj);

  const [existingEmail, existingCnpj] = await Promise.all([
    db.query.users.findFirst({ where: eq(schema.users.email, email) }),
    db.query.companies.findFirst({ where: eq(schema.companies.cnpj, cnpj) }),
  ]);
  if (existingEmail) return { status: "error", fieldErrors: { email: ["Já existe uma conta com este e-mail."] } };
  if (existingCnpj) return { status: "error", fieldErrors: { cnpj: ["Já existe uma conta cadastrada com este CNPJ."] } };

  const password = generateRandomPassword();
  const passwordHash = await hashPassword(password);
  const slug = await generateUniqueSlug(data.nomeFantasia, async (candidate) => {
    const existing = await db.query.companies.findFirst({ where: eq(schema.companies.slug, candidate) });
    return !!existing;
  });

  const userId = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({ email, passwordHash, role: "fornecedor", status: "aprovado" })
      .returning({ id: schema.users.id });
    await tx.insert(schema.companies).values({
      userId: user.id,
      razaoSocial: data.razaoSocial,
      nomeFantasia: data.nomeFantasia,
      cnpj,
      telefone: data.telefone,
      ramoAtividade: data.ramoAtividade,
      slug,
    });
    return user.id;
  });

  await logAudit({ actorId: admin.id, action: "user.create_supplier", entityType: "user", entityId: userId, after: { email, cnpj } });
  revalidateUserSurfaces();
  return { status: "success", message: "Fornecedor criado.", generatedPassword: password };
}

const createInternalUserSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  role: z.enum(["admin", "suporte"], { message: "Selecione um papel." }),
});

export async function createInternalUserAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireUser(["admin"]);
  const parsed = createInternalUserSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  const email = parsed.data.email.toLowerCase();

  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) return { status: "error", fieldErrors: { email: ["Já existe uma conta com este e-mail."] } };

  const password = generateRandomPassword();
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(schema.users)
    .values({ email, passwordHash, role: parsed.data.role, status: "aprovado" })
    .returning({ id: schema.users.id });

  await logAudit({ actorId: admin.id, action: "user.create_internal", entityType: "user", entityId: user.id, after: { email, role: parsed.data.role } });
  revalidateUserSurfaces();
  return { status: "success", message: "Conta criada.", generatedPassword: password };
}
