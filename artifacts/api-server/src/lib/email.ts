import { logger } from "./logger";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.warn({ to: options.to, subject: options.subject }, "RESEND_API_KEY não configurado — e-mail não enviado (apenas log)");
    logger.info({ to: options.to, subject: options.subject, preview: options.html.replace(/<[^>]+>/g, "").slice(0, 300) }, "Conteúdo do e-mail");
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const from = process.env.EMAIL_FROM || "Seu Zuca <noreply@seuzuca.com.br>";

  const result = await resend.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  if (result.error) {
    logger.error({ error: result.error, to: options.to }, "Falha ao enviar e-mail via Resend");
    throw new Error(`Falha ao enviar e-mail: ${result.error.message}`);
  }

  logger.info({ id: result.data?.id, to: options.to, subject: options.subject }, "E-mail enviado com sucesso");
}

export function buildVerificationEmailHtml(nome: string, verificationUrl: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 32px;">
      <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px;">
        <img src="https://seuzuca.com.br/logo.png" alt="Seu Zuca" style="height: 40px; margin-bottom: 24px;" />
        <h2 style="color: #C0181A; margin-bottom: 8px;">Confirme seu e-mail</h2>
        <p style="color: #555;">Olá, <strong>${nome}</strong>!</p>
        <p style="color: #555;">Clique no botão abaixo para confirmar seu endereço de e-mail e ativar sua conta no Seu Zuca.</p>
        <a href="${verificationUrl}" style="display:inline-block; margin: 24px 0; padding: 14px 28px; background: #C0181A; color: white; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Confirmar e-mail
        </a>
        <p style="color: #888; font-size: 13px;">Este link expira em 24 horas. Se você não criou uma conta no Seu Zuca, ignore este e-mail.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #aaa; font-size: 12px;">Seu Zuca — Marketplace B2B de Materiais de Construção</p>
      </div>
    </body>
    </html>
  `;
}

export function buildPasswordResetEmailHtml(nome: string, resetUrl: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 32px;">
      <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px;">
        <img src="https://seuzuca.com.br/logo.png" alt="Seu Zuca" style="height: 40px; margin-bottom: 24px;" />
        <h2 style="color: #C0181A; margin-bottom: 8px;">Recuperação de senha</h2>
        <p style="color: #555;">Olá, <strong>${nome}</strong>!</p>
        <p style="color: #555;">Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.</p>
        <a href="${resetUrl}" style="display:inline-block; margin: 24px 0; padding: 14px 28px; background: #C0181A; color: white; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Redefinir senha
        </a>
        <p style="color: #888; font-size: 13px;">Este link expira em 1 hora. Se você não solicitou a recuperação de senha, ignore este e-mail — sua senha não será alterada.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #aaa; font-size: 12px;">Seu Zuca — Marketplace B2B de Materiais de Construção</p>
      </div>
    </body>
    </html>
  `;
}
