import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireApprovedUser } from "@/lib/auth/require-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { OrderTimeline } from "@/components/order-timeline";
import { formatCentsToBRL, formatDate } from "@/lib/format";
import { ORDER_STATUS_LABELS, canTransition, type OrderStatus } from "@/lib/order-status";
import { buyerCancelOrderAction, buyerConfirmDeliveryAction } from "@/server/actions/order-actions";
import { getSignedInvoiceUrl } from "@/lib/storage";
import { DisputeDialog } from "./dispute-dialog";
import { ReviewDialog } from "./review-dialog";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Detalhe do pedido — Seu Zuca" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireApprovedUser(["comprador"]);
  const { id } = await params;

  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.id, id),
    with: {
      supplier: { with: { company: true } },
      items: true,
      statusEvents: { orderBy: (e, { asc }) => [asc(e.createdAt)] },
      checkoutGroup: { with: { deliveryAddress: true } },
    },
  });
  if (!order || order.buyerId !== user.id) notFound();

  const payment = await db.query.payments.findFirst({ where: eq(schema.payments.checkoutGroupId, order.checkoutGroupId) });
  const address = order.checkoutGroup.deliveryAddress;

  // pickup_codes has no drizzle relations() config against orders (see the same note in
  // src/app/fornecedor/painel/page.tsx) — fetched separately.
  const pickupCode =
    order.deliveryModality === "retirada" ? await db.query.pickupCodes.findFirst({ where: eq(schema.pickupCodes.orderId, order.id) }) : null;
  const pickupLocation = order.pickupLocationSnapshot as {
    label: string;
    logradouro: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    estado: string;
    horarioFuncionamento: string;
    prazoDisponibilizacaoDias: number;
    documentoExigido: string;
  } | null;

  const reviews = order.status === "entregue" ? await db.query.reviews.findMany({ where: eq(schema.reviews.orderId, order.id) }) : [];
  const reviewedProductIds = new Set(reviews.map((r) => r.productId));

  const signedInvoiceUrl = order.invoiceUrl ? await getSignedInvoiceUrl(order.invoiceUrl) : null;

  const canCancel = canTransition(order.status, "cancelado", "comprador");
  const canDispute = canTransition(order.status, "em_disputa", "comprador");
  const canConfirmDelivery = canTransition(order.status, "entregue", "comprador");

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/pedidos" className="text-sm text-muted-foreground hover:text-foreground">
        ← Meus pedidos
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{order.supplier.company?.nomeFantasia ?? "Fornecedor"}</h1>
          <p className="text-sm text-muted-foreground">Pedido feito em {formatDate(order.createdAt)}</p>
        </div>
        <Badge className="text-sm">{ORDER_STATUS_LABELS[order.status as OrderStatus]}</Badge>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Itens</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    {item.quantity}x {item.productNameSnapshot}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground">{formatCentsToBRL(item.totalCents)}</span>
                    {order.status === "entregue" &&
                      (reviewedProductIds.has(item.productId) ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle2 className="size-3.5" /> Avaliado
                        </span>
                      ) : (
                        <ReviewDialog orderId={order.id} productId={item.productId} productName={item.productNameSnapshot} />
                      ))}
                  </div>
                </div>
              ))}
              <div className="flex justify-between py-2 text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCentsToBRL(order.subtotalCents)}</span>
              </div>
              {Array.isArray(order.shippingBreakdown) && order.shippingBreakdown.length > 0 ? (
                (order.shippingBreakdown as { label: string; valueCents: number }[]).map((line, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm text-muted-foreground">
                    <span>{line.label}</span>
                    <span>{line.valueCents === 0 ? "Grátis" : formatCentsToBRL(line.valueCents)}</span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between py-2 text-sm text-muted-foreground">
                  <span>Frete</span>
                  <span>{order.shippingCents === 0 ? "Grátis" : formatCentsToBRL(order.shippingCents)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 font-semibold text-foreground">
                <span>Total</span>
                <span>{formatCentsToBRL(order.totalCents)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linha do tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline events={order.statusEvents} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {order.deliveryModality === "retirada" ? "Retirada" : order.deliveryModality === "transportadora" ? "Transportadora" : "Entrega"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {order.deliveryModality === "retirada" && pickupLocation ? (
                <>
                  <p className="font-medium text-foreground">{pickupLocation.label}</p>
                  <p>
                    {pickupLocation.logradouro}, {pickupLocation.numero}
                    {pickupLocation.complemento ? ` — ${pickupLocation.complemento}` : ""}
                  </p>
                  <p>
                    {pickupLocation.bairro}, {pickupLocation.cidade}/{pickupLocation.estado}
                  </p>
                  <p>Horário: {pickupLocation.horarioFuncionamento}</p>
                  <p>
                    Pronto para retirada em até {pickupLocation.prazoDisponibilizacaoDias} dia
                    {pickupLocation.prazoDisponibilizacaoDias === 1 ? "" : "s"} após o pagamento.
                  </p>
                  <p>Documento exigido: {pickupLocation.documentoExigido}</p>
                  {pickupCode && (
                    <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                      <p className="text-xs text-muted-foreground">Código de retirada</p>
                      <p className="font-mono text-xl font-semibold tracking-wider text-foreground">{pickupCode.code}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {pickupCode.used ? "Já utilizado." : "Apresente este código no local no momento da retirada."}
                      </p>
                    </div>
                  )}
                </>
              ) : order.deliveryModality === "transportadora" ? (
                <p>Você contratou uma transportadora própria para retirar este pedido no fornecedor — sem frete cobrado pela plataforma.</p>
              ) : (
                <>
                  <p>
                    {address.logradouro}, {address.numero}
                    {address.complemento ? ` — ${address.complemento}` : ""}
                  </p>
                  <p>
                    {address.bairro}, {address.cidade}/{address.estado}
                  </p>
                </>
              )}
              {order.trackingCode && (
                <p className="pt-2 text-foreground">
                  <strong>Rastreio:</strong> {order.trackingCode}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>Método: {payment?.method === "cartao" ? "Cartão de crédito" : payment?.method?.toUpperCase()}</p>
              <p>Status: {payment?.status ?? "—"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nota fiscal</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {signedInvoiceUrl ? (
                <a href={signedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                  Baixar {order.invoiceFileName}
                </a>
              ) : (
                <p>O fornecedor ainda não anexou a nota fiscal deste pedido.</p>
              )}
            </CardContent>
          </Card>

          {(canCancel || canDispute || canConfirmDelivery) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ações</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {canConfirmDelivery && (
                  <form
                    action={async () => {
                      "use server";
                      await buyerConfirmDeliveryAction(order.id);
                    }}
                  >
                    <Button type="submit" className="w-full">
                      Confirmar recebimento
                    </Button>
                  </form>
                )}
                {canDispute && <DisputeDialog orderId={order.id} />}
                {canCancel && (
                  <form
                    action={async () => {
                      "use server";
                      await buyerCancelOrderAction(order.id);
                    }}
                  >
                    <ConfirmSubmitButton
                      variant="outline"
                      className="w-full text-destructive"
                      confirmMessage="Cancelar este pedido?"
                    >
                      Cancelar pedido
                    </ConfirmSubmitButton>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
