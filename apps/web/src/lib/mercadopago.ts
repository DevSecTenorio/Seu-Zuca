import "server-only";
import { createHmac } from "node:crypto";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

export function isMercadoPagoConfigured(): boolean {
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN;
}

function getClient(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN is not set — call isMercadoPagoConfigured() first.");
  }
  return new MercadoPagoConfig({ accessToken });
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export type PixPaymentResult = {
  mpPaymentId: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  expiresAt: Date | null;
  raw: unknown;
};

export async function createPixPayment(input: {
  checkoutGroupId: string;
  amountCents: number;
  description: string;
  payerEmail: string;
  payerCnpj: string;
}): Promise<PixPaymentResult> {
  const payment = new Payment(getClient());
  const result = await payment.create({
    body: {
      transaction_amount: input.amountCents / 100,
      description: input.description,
      payment_method_id: "pix",
      payer: {
        email: input.payerEmail,
        identification: { type: "CNPJ", number: input.payerCnpj },
      },
      notification_url: `${getAppUrl()}/api/webhooks/mercadopago`,
      external_reference: input.checkoutGroupId,
    },
  });

  const pixData = result.point_of_interaction?.transaction_data;
  return {
    mpPaymentId: String(result.id),
    qrCode: pixData?.qr_code ?? null,
    qrCodeBase64: pixData?.qr_code_base64 ?? null,
    expiresAt: result.date_of_expiration ? new Date(result.date_of_expiration) : null,
    raw: result,
  };
}

export type BoletoPaymentResult = {
  mpPaymentId: string;
  barcode: string | null;
  ticketUrl: string | null;
  expiresAt: Date | null;
  raw: unknown;
};

export async function createBoletoPayment(input: {
  checkoutGroupId: string;
  amountCents: number;
  description: string;
  payerEmail: string;
  payerCnpj: string;
}): Promise<BoletoPaymentResult> {
  const payment = new Payment(getClient());
  const result = await payment.create({
    body: {
      transaction_amount: input.amountCents / 100,
      description: input.description,
      payment_method_id: "bolbradesco",
      payer: {
        email: input.payerEmail,
        identification: { type: "CNPJ", number: input.payerCnpj },
      },
      notification_url: `${getAppUrl()}/api/webhooks/mercadopago`,
      external_reference: input.checkoutGroupId,
    },
  });

  const barcode = (result as { barcode?: { content?: string } }).barcode?.content ?? null;
  return {
    mpPaymentId: String(result.id),
    barcode,
    ticketUrl: result.transaction_details?.external_resource_url ?? null,
    expiresAt: result.date_of_expiration ? new Date(result.date_of_expiration) : null,
    raw: result,
  };
}

export type CardPreferenceResult = {
  mpPreferenceId: string;
  initPoint: string | null;
  raw: unknown;
};

/** Card payment uses Checkout Pro: a hosted MP page handles tokenization, so no card data ever
 * touches our servers. */
export async function createCardCheckoutPreference(input: {
  checkoutGroupId: string;
  amountCents: number;
  description: string;
  payerEmail: string;
}): Promise<CardPreferenceResult> {
  const preference = new Preference(getClient());
  const result = await preference.create({
    body: {
      items: [
        {
          id: input.checkoutGroupId,
          title: input.description,
          quantity: 1,
          unit_price: input.amountCents / 100,
          currency_id: "BRL",
        },
      ],
      payer: { email: input.payerEmail },
      back_urls: {
        success: `${getAppUrl()}/pagamento?checkout=${input.checkoutGroupId}`,
        pending: `${getAppUrl()}/pagamento?checkout=${input.checkoutGroupId}`,
        failure: `${getAppUrl()}/pagamento?checkout=${input.checkoutGroupId}`,
      },
      auto_return: "approved",
      notification_url: `${getAppUrl()}/api/webhooks/mercadopago`,
      external_reference: input.checkoutGroupId,
    },
  });

  return { mpPreferenceId: result.id ?? "", initPoint: result.init_point ?? null, raw: result };
}

export async function fetchPayment(paymentId: string) {
  const payment = new Payment(getClient());
  return payment.get({ id: paymentId });
}

/**
 * Validates Mercado Pago's webhook signature (x-signature / x-request-id headers) per MP's
 * documented HMAC-SHA256 scheme: https://www.mercadopago.com.br/developers/en/docs/checkout-api/webhooks/additional-content/security
 * Without MERCADOPAGO_WEBHOOK_SECRET configured, validation is skipped (logged) — acceptable for
 * local development, but the secret is required for production per CLAUDE.md's "never trust
 * unauthenticated input" posture.
 */
export function verifyWebhookSignature(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("MERCADOPAGO_WEBHOOK_SECRET não configurado — pulando validação de assinatura do webhook.");
    return true;
  }
  if (!input.xSignature || !input.xRequestId) return false;

  const parts = Object.fromEntries(
    input.xSignature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return expected === v1;
}
