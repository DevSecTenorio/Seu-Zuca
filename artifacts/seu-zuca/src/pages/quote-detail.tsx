import { useState } from "react";
import { useParams } from "wouter";
import { useGetQuote, useRespondToQuote } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { FileText, ChevronLeft, CheckCircle2, Send, Package } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  respondida: "Respondida",
  aceita: "Aceita",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

const STATUS_COLOR: Record<string, string> = {
  pendente:   "bg-yellow-100 text-yellow-800",
  respondida: "bg-blue-100 text-blue-800",
  aceita:     "bg-green-100 text-green-800",
  encerrada:  "bg-gray-100 text-gray-700",
  cancelada:  "bg-red-100 text-red-800",
};

const BRL = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const { isSupplier, isApprovedBuyer } = useAuth();
  const { toast } = useToast();

  const { data: quote, isLoading, refetch } = useGetQuote(Number(id), {
    query: { enabled: !!id }
  });

  const respondMutation = useRespondToQuote();
  const [showForm, setShowForm] = useState(false);
  const [responseForm, setResponseForm] = useState({
    precoTotal: "",
    prazoEntrega: "",
    valorFrete: "",
    condicoes: "",
    validadeAte: "",
  });

  async function handleRespond(e: React.FormEvent) {
    e.preventDefault();
    if (!responseForm.precoTotal || !responseForm.prazoEntrega) {
      toast({ title: "Preço total e prazo são obrigatórios", variant: "destructive" });
      return;
    }
    try {
      await respondMutation.mutateAsync({
        id: Number(id),
        data: {
          precoTotal: parseFloat(responseForm.precoTotal),
          prazoEntrega: responseForm.prazoEntrega,
          valorFrete: responseForm.valorFrete ? parseFloat(responseForm.valorFrete) : 0,
          condicoes: responseForm.condicoes || undefined,
          validadeAte: responseForm.validadeAte || undefined,
        },
      });
      toast({ title: "Resposta enviada com sucesso!" });
      setShowForm(false);
      refetch();
    } catch {
      toast({ title: "Erro ao enviar resposta", variant: "destructive" });
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </Layout>
    );
  }

  if (!quote) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-muted-foreground">
          <FileText size={48} className="mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">Cotação não encontrada</p>
          <Link href="/cotacoes">
            <Button variant="outline" className="mt-4">Ver cotações</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const responses = (quote as { responses?: Array<{ id: number; supplierName?: string; precoTotal: number; prazoEntrega: string; valorFrete?: number; condicoes?: string; validadeAte?: string; status: string }> }).responses || [];
  const items = (quote as { items?: Array<{ id: number; productName?: string; quantidade: number }> }).items || [];
  const canRespond = isSupplier && !["aceita", "encerrada", "cancelada"].includes(quote.status);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <Link href="/cotacoes">
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ChevronLeft size={14} />
            Voltar às cotações
          </button>
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{(quote as { titulo?: string }).titulo || `Cotação #${id}`}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Criada em {new Date(quote.createdAt!).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
            {(quote as { buyerName?: string }).buyerName && (
              <p className="text-sm text-muted-foreground">Comprador: {(quote as { buyerName?: string }).buyerName}</p>
            )}
          </div>
          <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${STATUS_COLOR[quote.status] || "bg-gray-100 text-gray-700"}`}>
            {STATUS_LABEL[quote.status] || quote.status}
          </span>
        </div>

        {/* Descrição / observações */}
        {(quote as { observacoes?: string }).observacoes && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Observações do comprador</p>
              <p className="text-sm">{(quote as { observacoes?: string }).observacoes}</p>
            </CardContent>
          </Card>
        )}

        {/* Itens */}
        {items.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                <Package size={14} /> Itens solicitados
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="divide-y">
                {items.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between">
                    <span className="text-sm font-medium">{item.productName || `Produto #${item.id}`}</span>
                    <span className="text-sm text-muted-foreground">{item.quantidade} un.</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Respostas dos fornecedores */}
        {responses.length > 0 && (
          <div className="mb-4">
            <h2 className="text-base font-semibold mb-3">
              {responses.length} {responses.length === 1 ? "Proposta recebida" : "Propostas recebidas"}
            </h2>
            <div className="space-y-3">
              {responses.map((r) => (
                <Card key={r.id} className={`border ${r.status === "aceita" ? "border-green-300 bg-green-50/40" : "border-border"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">{r.supplierName || "Fornecedor"}</p>
                      {r.status === "aceita" && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
                          <CheckCircle2 size={13} /> Aceita
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Preço total</p>
                        <p className="font-bold text-[#C0181A]">{BRL(r.precoTotal)}</p>
                      </div>
                      {r.valorFrete !== undefined && r.valorFrete > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground">Frete</p>
                          <p className="font-medium">{BRL(r.valorFrete)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Prazo de entrega</p>
                        <p className="font-medium">{r.prazoEntrega}</p>
                      </div>
                      {r.validadeAte && (
                        <div>
                          <p className="text-xs text-muted-foreground">Válido até</p>
                          <p className="font-medium">{new Date(r.validadeAte).toLocaleDateString("pt-BR")}</p>
                        </div>
                      )}
                    </div>
                    {r.condicoes && (
                      <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{r.condicoes}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Formulário de resposta (fornecedor) */}
        {canRespond && (
          <div>
            {!showForm ? (
              <Button onClick={() => setShowForm(true)} className="gap-2 bg-[#C0181A] hover:bg-[#a01418] w-full sm:w-auto">
                <Send size={15} />
                Enviar proposta para esta cotação
              </Button>
            ) : (
              <Card className="border-[#E85D00]/30">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-base text-[#C0181A]">Sua proposta</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <form onSubmit={handleRespond} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Preço total (R$) *</Label>
                        <Input
                          type="number" step="0.01" min="0"
                          placeholder="0,00"
                          value={responseForm.precoTotal}
                          onChange={(e) => setResponseForm((f) => ({ ...f, precoTotal: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Valor do frete (R$)</Label>
                        <Input
                          type="number" step="0.01" min="0"
                          placeholder="0,00"
                          value={responseForm.valorFrete}
                          onChange={(e) => setResponseForm((f) => ({ ...f, valorFrete: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Prazo de entrega *</Label>
                        <Input
                          placeholder="Ex: 5 dias úteis"
                          value={responseForm.prazoEntrega}
                          onChange={(e) => setResponseForm((f) => ({ ...f, prazoEntrega: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Validade da proposta</Label>
                        <Input
                          type="date"
                          value={responseForm.validadeAte}
                          onChange={(e) => setResponseForm((f) => ({ ...f, validadeAte: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Condições / observações</Label>
                      <Textarea
                        placeholder="Condições de pagamento, especificações adicionais..."
                        value={responseForm.condicoes}
                        onChange={(e) => setResponseForm((f) => ({ ...f, condicoes: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={respondMutation.isPending} className="bg-[#C0181A] hover:bg-[#a01418]">
                        {respondMutation.isPending ? "Enviando..." : "Enviar proposta"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Empty state respostas */}
        {responses.length === 0 && !canRespond && (
          <div className="text-center py-10 text-muted-foreground">
            <FileText size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma proposta recebida ainda</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
