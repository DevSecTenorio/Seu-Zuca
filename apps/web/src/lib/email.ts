import "server-only";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Transactional email. Without RESEND_API_KEY (default in dev) it just logs to the
 * console, per CLAUDE.md — real delivery is opt-in via env var, never hardcoded.
 */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log("\n----- E-MAIL (dev, não enviado) -----");
    console.log(`Para: ${to}`);
    console.log(`Assunto: ${subject}`);
    console.log(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    console.log("--------------------------------------\n");
    return;
  }

  const from = process.env.EMAIL_FROM ?? "Seu Zuca <no-reply@seuzuca.com.br>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao enviar e-mail via Resend: ${response.status} ${body}`);
  }
}
