"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { generateToken, hashToken } from "@/lib/auth/crypto";
import { ROLE_HOME } from "@/lib/auth/roles";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { sendEmail } from "@/lib/email";
import {
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import { type FormState } from "./form-state";

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

export async function loginAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const email = parsed.data.email.toLowerCase();
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { status: "error", message: "E-mail ou senha inválidos." };
  }

  if (user.status === "suspenso") {
    return {
      status: "error",
      message: "Sua conta foi suspensa. Entre em contato com o suporte para mais informações.",
    };
  }
  if (user.status === "rejeitado") {
    return {
      status: "error",
      message: "Seu cadastro foi rejeitado. Entre em contato com o suporte para mais informações.",
    };
  }

  await createSession(user.id);
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));

  if (user.status === "pendente") redirect("/aguardando-aprovacao");

  const redirectTo = safeRedirectPath(formData.get("redirect"));
  redirect(redirectTo ?? ROLE_HOME[user.role]);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const email = parsed.data.email.toLowerCase();
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });

  // Same response whether or not the account exists, so the form can't be used to enumerate emails.
  if (user) {
    const token = generateToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
    await db.insert(schema.passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/redefinir-senha/${token}`;
    await sendEmail({
      to: user.email,
      subject: "Redefinição de senha — Seu Zuca",
      html: `<p>Recebemos uma solicitação para redefinir a senha da sua conta Seu Zuca.</p>
             <p><a href="${resetUrl}">Clique aqui para criar uma nova senha</a></p>
             <p>Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este e-mail.</p>`,
    });
  }

  return {
    status: "success",
    message:
      "Se houver uma conta com esse e-mail, enviamos um link de redefinição de senha. Confira sua caixa de entrada.",
  };
}

export async function resetPasswordAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { token, password } = parsed.data;
  const tokenHash = await hashToken(token);
  const record = await db.query.passwordResetTokens.findFirst({
    where: eq(schema.passwordResetTokens.tokenHash, tokenHash),
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return {
      status: "error",
      message: "Este link é inválido ou já expirou. Solicite uma nova redefinição de senha.",
    };
  }

  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, record.userId));
    await tx
      .update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(schema.passwordResetTokens.id, record.id));
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, record.userId));
  });

  redirect("/login?senha-redefinida=1");
}
