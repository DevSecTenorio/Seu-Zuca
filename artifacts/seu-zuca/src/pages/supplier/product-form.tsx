import { useParams, useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
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
import { AlertCircle, ChevronLeft, X, UploadCloud, ImagePlus, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";

// ─── Componente: Upload de imagens do produto ────────────────────────────────
function ProductImagesUploader({
  imagens,
  onAdd,
  onRemove,
  onMoveToFirst,
}: {
  imagens: string[];
  onAdd: (url: string) => void;
  onRemove: (url: string) => void;
  onMoveToFirst: (url: string) => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res) => {
      onAdd(`/api/storage${res.objectPath}`);
      toast({ title: "Imagem adicionada!" });
    },
    onError: (err) => {
      toast({ title: err.message || "Erro ao enviar imagem", variant: "destructive" });
    },
  });

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast({ title: `"${file.name}" não é uma imagem válida`, variant: "destructive" });
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: `"${file.name}" excede 5 MB`, variant: "destructive" });
        continue;
      }
      await uploadFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  function handleUrlAdd() {
    if (!urlInput.trim()) return;
    if (!imagens.includes(urlInput.trim())) onAdd(urlInput.trim());
    setUrlInput("");
    setShowUrlInput(false);
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ImagePlus size={16} />
          Imagens do produto
          <span className="text-xs font-normal text-muted-foreground ml-1">({imagens.length} foto{imagens.length !== 1 ? "s" : ""})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 py-7 rounded-xl border-2 border-dashed border-gray-200 hover:border-orange-400 hover:bg-orange-50/30 transition-all cursor-pointer"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={isUploading}
          />
          {isUploading ? (
            <>
              <div className="w-40 bg-gray-200 rounded-full h-1.5">
                <div className="bg-[#E85D00] h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">Enviando... {progress}%</span>
            </>
          ) : (
            <>
              <UploadCloud size={24} className="text-gray-400" />
              <span className="text-sm text-muted-foreground text-center">
                Arraste fotos aqui ou <span className="text-[#E85D00] font-medium">clique para selecionar</span>
              </span>
              <span className="text-xs text-gray-400">PNG, JPG, WebP — múltiplas fotos — máx. 5 MB cada</span>
            </>
          )}
        </div>

        {/* URL alternativa */}
        {showUrlInput ? (
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://exemplo.com/imagem.jpg"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleUrlAdd())}
              className="flex-1"
              autoFocus
            />
            <Button type="button" variant="outline" onClick={handleUrlAdd}>Adicionar</Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => setShowUrlInput(false)}><X size={15} /></Button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowUrlInput(true)} className="text-xs text-muted-foreground hover:text-[#E85D00] transition-colors">
            + Adicionar por URL externa
          </button>
        )}

        {/* Grid de imagens */}
        {imagens.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">A primeira imagem é a foto principal do produto. Passe o mouse para ver as opções.</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {imagens.map((img, i) => (
                <div key={img} className="relative group aspect-square rounded-lg overflow-hidden bg-muted border border-gray-100">
                  <img src={img} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect fill='%23f0f0f0' width='100' height='100'/><text x='50' y='55' text-anchor='middle' fill='%23999' font-size='12'>erro</text></svg>"; }} />
                  {i === 0 && (
                    <div className="absolute top-1 left-1 bg-[#E85D00] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">PRINCIPAL</div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {i !== 0 && (
                      <button type="button" onClick={() => onMoveToFirst(img)} title="Definir como principal" className="w-7 h-7 bg-white/90 text-[#E85D00] rounded-full flex items-center justify-center hover:bg-white">
                        <Star size={13} />
                      </button>
                    )}
                    <button type="button" onClick={() => onRemove(img)} className="w-7 h-7 bg-white/90 text-red-600 rounded-full flex items-center justify-center hover:bg-white">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Formulário principal ─────────────────────────────────────────────────────
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

  function removeImagem(url: string) {
    setForm((f) => ({ ...f, imagens: f.imagens.filter((i) => i !== url) }));
  }

  function moveToFirst(url: string) {
    setForm((f) => ({ ...f, imagens: [url, ...f.imagens.filter((i) => i !== url)] }));
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

          <ProductImagesUploader
            imagens={form.imagens}
            onAdd={(url) => setForm((f) => ({ ...f, imagens: [...f.imagens, url] }))}
            onRemove={removeImagem}
            onMoveToFirst={moveToFirst}
          />

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
