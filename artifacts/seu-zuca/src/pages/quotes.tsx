import { useState } from "react";
import { useListQuotes, useCreateQuote, useGetQuote } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const statusLabel: Record<string, string> = {
  aberta: "Aberta",
  respondida: "Respondida",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  aberta: "default",
  respondida: "outline",
  encerrada: "secondary",
  cancelada: "destructive",
};

export default function Quotes() {
  const { isAuthenticated, isApprovedBuyer } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const [newQuote, setNewQuote] = useState({
    titulo: "",
    descricao: "",
    dataExpiracao: "",
    items: [{ produtoDescricao: "", quantidade: 1, unidadeMedida: "unidade" }],
  });

  const { data: quotes, isLoading, refetch } = useListQuotes({ query: { enabled: isAuthenticated } });
  const createQuote = useCreateQuote();

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <FileText size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">Faça login para ver suas cotações</p>
          <Link href="/login"><Button>Entrar</Button></Link>
        </div>
      </Layout>
    );
  }

  async function handleCreate() {
    if (!newQuote.titulo) {
      toast({ title: "Informe o título da cotação", variant: "destructive" });
      return;
    }
    try {
      await createQuote.mutateAsync({ data: newQuote });
      toast({ title: "Cotação criada com sucesso!" });
      setDialogOpen(false);
      setNewQuote({ titulo: "", descricao: "", dataExpiracao: "", items: [{ produtoDescricao: "", quantidade: 1, unidadeMedida: "unidade" }] });
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao criar cotação";
      toast({ title: msg, variant: "destructive" });
    }
  }

  function addItem() {
    setNewQuote((q) => ({ ...q, items: [...q.items, { produtoDescricao: "", quantidade: 1, unidadeMedida: "unidade" }] }));
  }

  function updateItem(i: number, key: string, value: string | number) {
    setNewQuote((q) => {
      const items = [...q.items];
      items[i] = { ...items[i], [key]: value };
      return { ...q, items };
    });
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Cotações</h1>
          {isApprovedBuyer && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus size={16} />
                  Nova Cotação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nova Solicitação de Cotação</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="space-y-1.5">
                    <Label>Título *</Label>
                    <Input value={newQuote.titulo} onChange={(e) => setNewQuote((q) => ({ ...q, titulo: e.target.value }))} placeholder="Ex: Materiais para obra Rua das Flores" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descrição</Label>
                    <Textarea value={newQuote.descricao} onChange={(e) => setNewQuote((q) => ({ ...q, descricao: e.target.value }))} placeholder="Descreva os requisitos especiais..." rows={3} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data de Expiração</Label>
                    <Input type="date" value={newQuote.dataExpiracao} onChange={(e) => setNewQuote((q) => ({ ...q, dataExpiracao: e.target.value }))} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Itens da Cotação</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addItem}>
                        <Plus size={12} className="mr-1" /> Adicionar
                      </Button>
                    </div>
                    {newQuote.items.map((item, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <Input
                            value={item.produtoDescricao}
                            onChange={(e) => updateItem(i, "produtoDescricao", e.target.value)}
                            placeholder="Descrição do produto"
                          />
                        </div>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            value={item.quantidade}
                            onChange={(e) => updateItem(i, "quantidade", Number(e.target.value))}
                            className="w-20"
                            min={1}
                          />
                          <Input
                            value={item.unidadeMedida}
                            onChange={(e) => updateItem(i, "unidadeMedida", e.target.value)}
                            placeholder="un"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleCreate} disabled={createQuote.isPending}>
                      {createQuote.isPending ? "Criando..." : "Criar Cotação"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : quotes && quotes.length > 0 ? (
          <div className="space-y-4">
            {quotes.map((quote) => (
              <Link key={quote.id} href={`/cotacao/${quote.id}`}>
                <Card className="border-border hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-semibold text-sm">{quote.titulo}</span>
                          <Badge variant={statusVariant[quote.status] || "secondary"} className="text-xs">
                            {statusLabel[quote.status] || quote.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Criada em {new Date(quote.createdAt!).toLocaleDateString("pt-BR")}
                          {quote.dataExpiracao && ` • Expira em ${new Date(quote.dataExpiracao).toLocaleDateString("pt-BR")}`}
                        </p>
                        {quote.totalRespostas !== undefined && (
                          <p className="text-xs text-muted-foreground mt-0.5">{quote.totalRespostas} {quote.totalRespostas === 1 ? "resposta" : "respostas"}</p>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground ml-4 shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhuma cotação ainda</p>
            {isApprovedBuyer && (
              <>
                <p className="text-sm mt-1 mb-6">Solicite cotações de múltiplos fornecedores de uma vez</p>
                <Button onClick={() => setDialogOpen(true)}>Criar primeira cotação</Button>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
