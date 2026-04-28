import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, Copy, ExternalLink, Loader2, QrCode,
  FileText, CreditCard, AlertCircle, RefreshCw, Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type PaymentData = {
  id: number;
  orderId: number;
  metodo: string;
  status: string;
  externalId?: string | null;
  qrCode?: string | null;
  qrCodeBase64?: string | null;
  ticketUrl?: string | null;
  codigoBarras?: string | null;
  checkoutUrl?: string | null;
  valor?: number | null;
  expiresAt?: string | null;
  mock?: boolean;
};

function usePaymentParams() {
  const [, navigate] = useLocation();
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const orderIdsRaw = params.get("orders") || "";
  const metodo = params.get("metodo") || "pix";
  const orderIds = orderIdsRaw.split(",").map(Number).filter(Boolean);
  return { orderIds, metodo, navigate };
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function tick() {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Expirado"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}:${s.toString().padStart(2, "0")}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <span className="flex items-center gap-1 text-amber-600 font-mono text-sm">
      <Clock size={13} /> Expira em {remaining}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copiado!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 shrink-0">
      {copied ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
      {label || (copied ? "Copiado!" : "Copiar")}
    </Button>
  );
}

function PixPanel({ payment }: { payment: PaymentData }) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Escaneie o QR Code abaixo com o app do seu banco ou use o código Copia e Cola.
        </p>
      </div>

      {payment.qrCodeBase64 ? (
        <div className="flex justify-center">
          <img
            src={`data:image/png;base64,${payment.qrCodeBase64}`}
            alt="QR Code PIX"
            className="w-56 h-56 border-2 border-border rounded-xl p-2 bg-white"
          />
        </div>
      ) : (
        <div className="flex justify-center">
          <div className="w-56 h-56 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 bg-muted/30">
            <QrCode size={48} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground text-center px-4">
              QR Code disponível após ativar o Mercado Pago
            </p>
          </div>
        </div>
      )}

      {payment.qrCode && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Copia e Cola</p>
          <div className="flex gap-2 items-start">
            <div className="flex-1 bg-muted rounded-lg p-3 font-mono text-xs break-all text-muted-foreground leading-relaxed max-h-24 overflow-y-auto">
              {payment.qrCode}
            </div>
            <CopyButton text={payment.qrCode} />
          </div>
        </div>
      )}

      {payment.expiresAt && <CountdownTimer expiresAt={payment.expiresAt} />}

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
        <p className="text-xs font-medium text-blue-800">Como pagar via PIX:</p>
        <ol className="text-xs text-blue-700 space-y-0.5 list-decimal list-inside">
          <li>Abra o app do seu banco</li>
          <li>Acesse a área PIX e escolha "Pagar com QR Code" ou "Copia e Cola"</li>
          <li>Cole o código acima ou escaneie o QR Code</li>
          <li>Confirme o valor e finalize o pagamento</li>
        </ol>
      </div>
    </div>
  );
}

function BoletoPanel({ payment }: { payment: PaymentData }) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          O boleto tem vencimento em 3 dias úteis. Após o pagamento, a confirmação pode levar até 2 dias úteis.
        </p>
      </div>

      {payment.ticketUrl && (
        <a href={payment.ticketUrl} target="_blank" rel="noopener noreferrer">
          <Button className="w-full gap-2 bg-[#C0181A] hover:bg-[#a01418]" size="lg">
            <ExternalLink size={16} />
            Abrir Boleto Bancário
          </Button>
        </a>
      )}

      {payment.codigoBarras && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Linha Digitável</p>
          <div className="flex gap-2 items-center">
            <div className="flex-1 bg-muted rounded-lg p-3 font-mono text-xs break-all text-muted-foreground">
              {payment.codigoBarras}
            </div>
            <CopyButton text={payment.codigoBarras} />
          </div>
        </div>
      )}

      {payment.expiresAt && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock size={12} />
          Vence em: {new Date(payment.expiresAt).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      )}

      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-1">
        <p className="text-xs font-medium text-amber-800">Atenção:</p>
        <p className="text-xs text-amber-700">
          Boletos compensam em até 2 dias úteis. Não pague após o vencimento. Em caso de dúvidas, entre em contato com nosso suporte.
        </p>
      </div>
    </div>
  );
}

function CartaoPanel({ payment }: { payment: PaymentData }) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Você será redirecionado para o checkout seguro do Mercado Pago para concluir o pagamento com cartão.
        </p>
      </div>

      {payment.checkoutUrl ? (
        <a href={payment.checkoutUrl} target="_blank" rel="noopener noreferrer">
          <Button className="w-full gap-2 bg-[#009EE3] hover:bg-[#007ab5] text-white" size="lg">
            <CreditCard size={16} />
            Pagar com Mercado Pago
          </Button>
        </a>
      ) : (
        <Button className="w-full" size="lg" disabled>
          <Loader2 size={16} className="animate-spin mr-2" />
          Gerando link de pagamento...
        </Button>
      )}

      <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
        <span>Ambiente seguro</span>
        <span>•</span>
        <span>Dados criptografados</span>
        <span>•</span>
        <span>Aceita até 12x</span>
      </div>
    </div>
  );
}

export default function Payment() {
  const { isApprovedBuyer } = useAuth();
  const { orderIds, metodo, navigate } = usePaymentParams();
  const { toast } = useToast();

  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  const [polling, setPolling] = useState(false);

  const createPayment = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderIds, metodo }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError((data as { message?: string }).message || "Erro ao gerar pagamento");
        return;
      }
      setPayment(data as PaymentData);
      if ((data as PaymentData).mock) {
        toast({
          title: "Modo de demonstração",
          description: "Configure MERCADO_PAGO_ACCESS_TOKEN para pagamentos reais.",
        });
      }
    } catch {
      setError("Falha de conexão ao gerar pagamento");
    } finally {
      setLoading(false);
    }
  }, [orderIds, metodo]);

  const checkStatus = useCallback(async () => {
    if (!orderIds[0] || paid) return;
    setPolling(true);
    try {
      const r = await fetch(`/api/payments/status/${orderIds[0]}`, { credentials: "include" });
      if (r.ok) {
        const data = await r.json() as { pago: boolean; payment?: PaymentData };
        if (data.pago) { setPaid(true); }
        if (data.payment) { setPayment(data.payment); }
      }
    } catch { /* silent */ } finally {
      setPolling(false);
    }
  }, [orderIds, paid]);

  useEffect(() => {
    if (isApprovedBuyer && orderIds.length > 0) createPayment();
  }, []);

  useEffect(() => {
    if (!payment || paid || metodo === "cartao") return;
    const id = setInterval(checkStatus, 8000);
    return () => clearInterval(id);
  }, [payment, paid, metodo, checkStatus]);

  const metodoLabel: Record<string, string> = { pix: "PIX", boleto: "Boleto Bancário", cartao: "Cartão de Crédito" };
  const metodoIcon: Record<string, React.ReactNode> = {
    pix: <QrCode size={16} />,
    boleto: <FileText size={16} />,
    cartao: <CreditCard size={16} />,
  };

  if (!isApprovedBuyer) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Acesso restrito a compradores aprovados.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Pagamento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pedido{orderIds.length > 1 ? "s" : ""} #{orderIds.join(", ")}
          </p>
        </div>

        {paid ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <CheckCircle2 size={52} className="mx-auto text-green-500" />
              <div>
                <h2 className="text-xl font-bold text-green-800">Pagamento Confirmado!</h2>
                <p className="text-sm text-green-700 mt-1">
                  Seu pagamento foi processado com sucesso. O fornecedor já foi notificado.
                </p>
              </div>
              <Button onClick={() => navigate("/pedidos")} className="bg-green-600 hover:bg-green-700">
                Ver Meus Pedidos
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-none border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {metodoIcon[metodo]}
                  {metodoLabel[metodo] || metodo}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {payment?.mock && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">Demo</Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {payment?.status === "approved" ? "Aprovado" : "Aguardando pagamento"}
                  </Badge>
                </div>
              </div>
              {payment?.valor && (
                <>
                  <Separator className="mt-3" />
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-sm text-muted-foreground">Total a pagar</span>
                    <span className="text-xl font-bold text-[#C0181A]">{BRL(payment.valor)}</span>
                  </div>
                </>
              )}
            </CardHeader>

            <CardContent>
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 size={32} className="animate-spin text-[#C0181A]" />
                  <p className="text-sm text-muted-foreground">Gerando {metodoLabel[metodo]}...</p>
                </div>
              )}

              {error && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                  <Button variant="outline" className="w-full gap-2" onClick={createPayment}>
                    <RefreshCw size={14} />
                    Tentar novamente
                  </Button>
                </div>
              )}

              {!loading && !error && payment && (
                <>
                  {metodo === "pix" && <PixPanel payment={payment} />}
                  {metodo === "boleto" && <BoletoPanel payment={payment} />}
                  {metodo === "cartao" && <CartaoPanel payment={payment} />}

                  {metodo !== "cartao" && (
                    <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        {polling && <Loader2 size={11} className="animate-spin" />}
                        Verificando pagamento automaticamente...
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={checkStatus}>
                        <RefreshCw size={12} />
                        Verificar agora
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-4 text-center">
          <Button variant="link" size="sm" className="text-muted-foreground" onClick={() => navigate("/pedidos")}>
            Ir para Meus Pedidos
          </Button>
        </div>
      </div>
    </Layout>
  );
}
