import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CheckCircle2, Clock, Copy } from "lucide-react";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCentsToBRL } from "@/lib/format";
import { isMercadoPagoConfigured } from "@/lib/mercadopago";
import { PaymentStatusPoller } from "./payment-status-poller";

export const metadata: Metadata = { title: "Pagamento — Seu Zuca" };

type MpPixPayload = { point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } } };
type MpBoletoPayload = { barcode?: { content?: string }; transaction_details?: { external_resource_url?: string } };

export default async function PaymentPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const user = await requireApprovedUser(["comprador"]);
  const { checkout } = await searchParams;
  if (!checkout) notFound();

  const checkoutGroup = await db.query.checkoutGroups.findFirst({ where: eq(schema.checkoutGroups.id, checkout) });
  if (!checkoutGroup || checkoutGroup.buyerId !== user.id) notFound();

  const [payment, orders] = await Promise.all([
    db.query.payments.findFirst({ where: eq(schema.payments.checkoutGroupId, checkout) }),
    db.query.orders.findMany({ where: eq(schema.orders.checkoutGroupId, checkout) }),
  ]);
  if (!payment) notFound();

  if (payment.status === "pago") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <CheckCircle2 className="size-14 text-success" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">Pagamento confirmado!</h1>
        <p className="mt-2 text-muted-foreground">
          Seu pedido foi dividido em {orders.length} pedido{orders.length > 1 ? "s" : ""}. Acompanhe o status
          de cada um em &ldquo;Meus pedidos&rdquo;.
        </p>
        <Button asChild className="mt-6">
          <Link href="/pedidos">Ver meus pedidos</Link>
        </Button>
      </div>
    );
  }

  if (payment.status === "falhou" || payment.status === "estornado") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-foreground">Pagamento não aprovado</h1>
        <p className="mt-2 text-muted-foreground">
          Não foi possível confirmar o pagamento. Seus pedidos continuam salvos — acompanhe em &ldquo;Meus
          pedidos&rdquo; ou entre em contato com o suporte.
        </p>
        <Button asChild className="mt-6">
          <Link href="/pedidos">Ver meus pedidos</Link>
        </Button>
      </div>
    );
  }

  const totalCents = orders.reduce((sum, o) => sum + o.totalCents, 0);

  if (!isMercadoPagoConfigured()) {
    return (
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-16 sm:px-6 lg:px-8">
        <Alert>
          <Clock className="size-4" />
          <AlertDescription>
            Mercado Pago não está configurado neste ambiente. Seu pedido foi criado normalmente
            (total de {formatCentsToBRL(totalCents)}), mas o pagamento precisa ser confirmado
            manualmente pelo administrador até a integração ser configurada com uma chave de API real.
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-6 w-full">
          <Link href="/pedidos">Ver meus pedidos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-4 py-16 sm:px-6 lg:px-8">
      <PaymentStatusPoller />
      <Card>
        <CardHeader>
          <CardTitle>Finalize seu pagamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-2xl font-semibold text-foreground">{formatCentsToBRL(totalCents)}</p>

          {payment.method === "pix" && <PixInstructions payload={payment.webhookPayload as MpPixPayload | null} />}
          {payment.method === "boleto" && <BoletoInstructions payload={payment.webhookPayload as MpBoletoPayload | null} />}
          {payment.method === "cartao" && (
            <p className="text-sm text-muted-foreground">
              Aguardando confirmação do checkout de cartão do Mercado Pago...
            </p>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" /> Esta página atualiza automaticamente assim que o pagamento for
            confirmado.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PixInstructions({ payload }: { payload: MpPixPayload | null }) {
  const qrCode = payload?.point_of_interaction?.transaction_data?.qr_code;
  const qrCodeBase64 = payload?.point_of_interaction?.transaction_data?.qr_code_base64;

  if (!qrCode) {
    return <p className="text-sm text-muted-foreground">Gerando QR code PIX...</p>;
  }

  return (
    <div className="space-y-3">
      {qrCodeBase64 && (
        <Image
          src={`data:image/png;base64,${qrCodeBase64}`}
          alt="QR Code PIX"
          width={220}
          height={220}
          unoptimized
          className="mx-auto rounded-md border"
        />
      )}
      <div>
        <p className="text-sm font-medium text-foreground">PIX copia e cola</p>
        <div className="mt-1 flex items-center gap-2 rounded-md border bg-muted/40 p-2">
          <code className="flex-1 truncate text-xs">{qrCode}</code>
          <Copy className="size-4 shrink-0 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

function BoletoInstructions({ payload }: { payload: MpBoletoPayload | null }) {
  const barcode = payload?.barcode?.content;
  const ticketUrl = payload?.transaction_details?.external_resource_url;

  if (!barcode && !ticketUrl) {
    return <p className="text-sm text-muted-foreground">Gerando boleto...</p>;
  }

  return (
    <div className="space-y-3">
      {barcode && (
        <div>
          <p className="text-sm font-medium text-foreground">Código de barras</p>
          <code className="mt-1 block rounded-md border bg-muted/40 p-2 text-xs break-all">{barcode}</code>
        </div>
      )}
      {ticketUrl && (
        <Button asChild variant="outline" className="w-full">
          <a href={ticketUrl} target="_blank" rel="noreferrer">
            Ver boleto
          </a>
        </Button>
      )}
    </div>
  );
}
