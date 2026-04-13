import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useGetProduct, useCreateProduct, useUpdateProduct, useListCategories } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, ChevronLeft, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProductForm() {
  const { id } = useParams<{ id?: string }>();
  const isEditing = id && id !== "novo";
  const [, navigate] = useLocation();
  const { isSupplier } = useAuth();
  const { toast } = useToast();
  const [error, setError] = useState("");

  const { data: categories } = useListCategories();
  const { data: product } = useGetProduct(isEditing ? id! : "", { query: { enabled: !!isEditing } });
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  const [form, setForm] = useState({
    nome: "", descricao: "", sku: "", preco: "", unidadeMedida: "", estoque: "",
    categoryId: "", prazoFrete: "7", alertaEstoque: "", disponivel: true,
    imagens: [] as string[],
  });
  const [newImagem, setNewImagem] = useState("");

  useEffect(() => {
    if (product && isEditing) {
      setForm({
        nome: product.nome || "",
        descricao: product.descricao || "",
        sku: (product as { sku?: string }).sku || "",
        preco: String(product.preco || ""),
        unidadeMedida: product.unidadeMedida || "",
        estoque: String(product.estoque || ""),
        categoryId: String((product as { categoryId?: number }).categoryId || ""),
        prazoFrete: String((product as { prazoFrete?: number }).prazoFrete || "7"),
        alertaEstoque: String((product as { alertaEstoque?: number }).alertaEstoque || ""),
        disponivel: product.disponivel ?? true,
        imagens: (product as { imagens?: string[] }).imagens || [],
      });
    }
  }, [product, isEditing]);

  if (!isSupplier) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Acesso restrito a fornecedores</p>
        </div>
      </Layout>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const payload = {
      ...form,
      preco: parseFloat(form.preco),
      estoque: parseInt(form.estoque),
      categoryId: parseInt(form.categoryId),
      prazoFrete: parseInt(form.prazoFrete),
      alertaEstoque: form.alertaEstoque ? parseInt(form.alertaEstoque) : undefined,
    };

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: id!, data: payload });
        toast({ title: "Produto atualizado com sucesso!" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "Produto criado com sucesso!" });
      }
      navigate("/fornecedor/painel");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao salvar produto";
      setError(msg);
    }
  }

  function addImagem() {
    if (newImagem && !form.imagens.includes(newImagem)) {
      setForm((f) => ({ ...f, imagens: [...f.imagens, newImagem] }));
      setNewImagem("");
    }
  }

  function removeImagem(url: string) {
    setForm((f) => ({ ...f, imagens: f.imagens.filter((i) => i !== url) }));
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate("/fornecedor/painel")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft size={14} />
          Voltar ao painel
        </button>

        <h1 className="text-2xl font-bold mb-6">
          {isEditing ? "Editar Produto" : "Novo Produto"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Nome do Produto *</Label>
                <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Descrição *</Label>
                <Textarea value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} rows={4} required />
              </div>
              <div className="space-y-1.5">
                <Label>SKU *</Label>
                <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="CIM-CP2-50" required />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria *</Label>
                <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>{cat.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Preço (R$) *</Label>
                <Input type="number" step="0.01" value={form.preco} onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Unidade de Medida *</Label>
                <Input value={form.unidadeMedida} onChange={(e) => setForm((f) => ({ ...f, unidadeMedida: e.target.value }))} placeholder="saco, m², kg, unidade..." required />
              </div>
              <div className="space-y-1.5">
                <Label>Estoque *</Label>
                <Input type="number" value={form.estoque} onChange={(e) => setForm((f) => ({ ...f, estoque: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Alerta de Estoque</Label>
                <Input type="number" value={form.alertaEstoque} onChange={(e) => setForm((f) => ({ ...f, alertaEstoque: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Prazo de Frete (dias úteis)</Label>
                <Input type="number" value={form.prazoFrete} onChange={(e) => setForm((f) => ({ ...f, prazoFrete: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.disponivel}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, disponivel: v }))}
                  id="disponivel"
                />
                <Label htmlFor="disponivel">Produto disponível para venda</Label>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Imagens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={newImagem}
                  onChange={(e) => setNewImagem(e.target.value)}
                  placeholder="URL da imagem (https://...)"
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={addImagem}>
                  <Plus size={16} />
                </Button>
              </div>
              {form.imagens.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {form.imagens.map((img, i) => (
                    <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImagem(img)}
                        className="absolute top-1 right-1 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/fornecedor/painel")}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar produto"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
