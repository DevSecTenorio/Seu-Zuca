import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useRegisterUser, useLookupCep } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Building2, Store, UploadCloud, FileText, X, CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";

/* ── tipos ─────────────────────────────────────────────────────────────── */
type DocTipo = "cartao_cnpj" | "contrato_social" | "identidade" | "comprovante_endereco" | "alvara" | "outros";
interface Documento { tipo: DocTipo; nome: string; url: string; nomeArquivo: string; }

const DOC_TIPOS: { value: DocTipo; label: string; obrigatorio?: boolean; somenteSupplier?: boolean }[] = [
  { value: "cartao_cnpj",          label: "Cartão CNPJ",              obrigatorio: true },
  { value: "contrato_social",      label: "Contrato Social / Estatuto" },
  { value: "identidade",           label: "RG ou CNH do responsável"  },
  { value: "comprovante_endereco", label: "Comprovante de endereço"   },
  { value: "alvara",               label: "Alvará de funcionamento",   somenteSupplier: true },
  { value: "outros",               label: "Outros documentos"         },
];

/* ── helpers ────────────────────────────────────────────────────────────── */
function formatCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}
function validateCnpj(cnpj: string) {
  const c = cnpj.replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const d = (digits: string, w: number[]) => { const s = digits.split("").reduce((a, x, i) => a + +x * w[i], 0); const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return +c[12] === d(c.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]) && +c[13] === d(c.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]);
}
function formatCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d)/, "$1-$2");
}

/* ── uploader de um documento ─────────────────────────────────────────── */
function DocUploader({ tipo, label, onAdd, jaEnviado }: {
  tipo: DocTipo; label: string;
  onAdd: (doc: Documento) => void;
  jaEnviado: boolean;
}) {
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res) => {
      onAdd({ tipo, nome: label, url: `/api/storage${res.objectPath}`, nomeArquivo: res.objectPath.split("/").pop() || label });
      toast({ title: `${label} enviado!` });
    },
    onError: (err) => toast({ title: err.message || "Erro ao enviar", variant: "destructive" }),
  });

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) { toast({ title: "Arquivo maior que 10 MB", variant: "destructive" }); return; }
    await uploadFile(file);
    if (ref.current) ref.current.value = "";
  }

  return (
    <div
      className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
        jaEnviado ? "border-green-300 bg-green-50" : "border-dashed border-gray-200 hover:border-[#C0181A]/50 hover:bg-red-50/20"
      }`}
      onClick={() => !isUploading && !jaEnviado && ref.current?.click()}
    >
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

      {jaEnviado ? (
        <CheckCircle2 size={20} className="text-green-500 shrink-0" />
      ) : isUploading ? (
        <Loader2 size={20} className="text-[#C0181A] animate-spin shrink-0" />
      ) : (
        <UploadCloud size={20} className="text-gray-400 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${jaEnviado ? "text-green-700" : "text-gray-700"}`}>{label}</p>
        {isUploading ? (
          <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
            <div className="bg-[#C0181A] h-1 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{jaEnviado ? "Enviado ✓" : "PDF, JPG ou PNG — máx. 10 MB"}</p>
        )}
      </div>
    </div>
  );
}

/* ── componente principal ─────────────────────────────────────────────── */
export default function Register() {
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<"buyer" | "supplier">("buyer");
  const [form, setForm] = useState({
    email: "", password: "", nome: "", cnpj: "", razaoSocial: "", nomeFantasia: "",
    telefone: "", ramo: "", cep: "", logradouro: "", numero: "", complemento: "",
    bairro: "", cidade: "", estado: "",
  });
  const [cnpjError, setCnpjError] = useState("");
  const [error, setError] = useState("");
  const [cepQuery, setCepQuery] = useState("");
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const registerMutation = useRegisterUser();
  const { toast } = useToast();
  const { data: cepData } = useLookupCep(cepQuery, { query: { enabled: cepQuery.length === 8 } });

  useEffect(() => {
    if (!cepData) return;
    setForm((f) => ({
      ...f,
      logradouro: (cepData as { logradouro?: string }).logradouro || f.logradouro,
      bairro: (cepData as { bairro?: string }).bairro || f.bairro,
      cidade: (cepData as { cidade?: string }).cidade || f.cidade,
      estado: (cepData as { estado?: string }).estado || f.estado,
    }));
  }, [cepData]);

  function handleCnpjChange(v: string) {
    const f = formatCnpj(v);
    setForm((s) => ({ ...s, cnpj: f }));
    const c = f.replace(/\D/g, "");
    setCnpjError(c.length === 14 ? (validateCnpj(c) ? "" : "CNPJ inválido") : "");
  }

  function handleCepChange(v: string) {
    const f = formatCep(v);
    setForm((s) => ({ ...s, cep: f, logradouro: "", bairro: "", cidade: "", estado: "" }));
    const d = f.replace(/\D/g, "");
    if (d.length === 8) setCepQuery(d);
  }

  function handleNextStep(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!validateCnpj(form.cnpj)) { setError("CNPJ inválido"); return; }
    setStep(2);
  }

  function addDocumento(doc: Documento) {
    setDocumentos((prev) => {
      const filtered = prev.filter((d) => d.tipo !== doc.tipo);
      return [...filtered, doc];
    });
  }

  function removeDocumento(tipo: DocTipo) {
    setDocumentos((prev) => prev.filter((d) => d.tipo !== tipo));
  }

  async function handleSubmit() {
    setError("");
    const cartaoCnpj = documentos.find((d) => d.tipo === "cartao_cnpj");
    if (!cartaoCnpj) { setError("O Cartão CNPJ é obrigatório"); return; }
    try {
      await registerMutation.mutateAsync({
        data: { ...form, role, cnpj: form.cnpj.replace(/\D/g, ""), documentos },
      });
      await queryClient.invalidateQueries();
      if (role === "buyer") {
        navigate("/cadastro/aguardando");
      } else {
        toast({ title: "Conta de fornecedor criada com sucesso!" });
        navigate("/fornecedor/painel");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao criar conta";
      setError(msg);
    }
  }

  const tiposFiltrados = DOC_TIPOS.filter((t) => !t.somenteSupplier || role === "supplier");
  const docEnviado = (tipo: DocTipo) => documentos.some((d) => d.tipo === tipo);
  const obrigatoriosOk = tiposFiltrados.filter((t) => t.obrigatorio).every((t) => docEnviado(t.value));

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex">
      {/* Painel esquerdo — formulário */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-4 mb-8">
            <div className="overflow-hidden flex items-center justify-center" style={{ width: 160, height: 56 }}>
              <img
                src="/logo-seuzuca.png"
                alt="Seu Zuca"
                style={{ transform: "scale(2.4)", transformOrigin: "center center", width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
          </Link>

          {/* Indicador de etapas */}
          <div className="flex items-center gap-3 mb-6">
            {[
              { n: 1, label: "Dados da empresa" },
              { n: 2, label: "Documentos" },
            ].map(({ n, label }, i, arr) => (
              <div key={n} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step === n ? "bg-[#C0181A] text-white" : step > n ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
                  }`}>
                    {step > n ? <CheckCircle2 size={14} /> : n}
                  </div>
                  <span className={`text-sm font-medium ${step === n ? "text-gray-900" : "text-gray-400"}`}>{label}</span>
                </div>
                {i < arr.length - 1 && <ChevronRight size={14} className="text-gray-300" />}
              </div>
            ))}
          </div>

          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">{step === 1 ? "Criar conta B2B" : "Documentos da empresa"}</CardTitle>
              <CardDescription>
                {step === 1
                  ? "Plataforma exclusiva para Pessoas Jurídicas com CNPJ ativo"
                  : "Envie os documentos para análise e aprovação do cadastro"}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {/* ─── ETAPA 1: dados da empresa ─────────────────────────── */}
              {step === 1 && (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <button type="button" onClick={() => setRole("buyer")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${role === "buyer" ? "border-[#C0181A] bg-red-50/60" : "border-border hover:border-[#C0181A]/40"}`}>
                      <Building2 size={24} className={role === "buyer" ? "text-[#C0181A]" : "text-muted-foreground"} />
                      <span className="text-sm font-medium">Comprador</span>
                      <span className="text-xs text-muted-foreground text-center">Construtoras, empreiteiras</span>
                    </button>
                    <button type="button" onClick={() => setRole("supplier")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${role === "supplier" ? "border-[#C0181A] bg-red-50/60" : "border-border hover:border-[#C0181A]/40"}`}>
                      <Store size={24} className={role === "supplier" ? "text-[#C0181A]" : "text-muted-foreground"} />
                      <span className="text-sm font-medium">Fornecedor</span>
                      <span className="text-xs text-muted-foreground text-center">Lojas e distribuidoras</span>
                    </button>
                  </div>

                  <form onSubmit={handleNextStep} className="space-y-4">
                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                        <AlertCircle size={15} className="shrink-0" />{error}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>CNPJ *</Label>
                        <Input value={form.cnpj} onChange={(e) => handleCnpjChange(e.target.value)} placeholder="00.000.000/0000-00" required />
                        {cnpjError && <p className="text-xs text-destructive">{cnpjError}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Razão Social *</Label>
                        <Input value={form.razaoSocial} onChange={(e) => setForm((f) => ({ ...f, razaoSocial: e.target.value }))} placeholder="Empresa LTDA" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Nome Fantasia</Label>
                        <Input value={form.nomeFantasia} onChange={(e) => setForm((f) => ({ ...f, nomeFantasia: e.target.value }))} placeholder="Nome comercial" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Nome do responsável *</Label>
                        <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="João Silva" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Ramo de atividade</Label>
                        <Input value={form.ramo} onChange={(e) => setForm((f) => ({ ...f, ramo: e.target.value }))} placeholder="Ex: Construção Civil" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Telefone</Label>
                        <Input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} placeholder="(11) 98888-7777" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>E-mail *</Label>
                        <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="contato@empresa.com.br" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Senha *</Label>
                        <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" required minLength={8} />
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <h3 className="font-medium mb-3 text-sm text-gray-600">Endereço</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label>CEP</Label>
                          <Input value={form.cep} onChange={(e) => handleCepChange(e.target.value)} placeholder="00000-000" />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Logradouro</Label>
                          <Input value={form.logradouro} onChange={(e) => setForm((f) => ({ ...f, logradouro: e.target.value }))} placeholder="Rua, Avenida..." />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Número</Label>
                          <Input value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} placeholder="123" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Complemento</Label>
                          <Input value={form.complemento} onChange={(e) => setForm((f) => ({ ...f, complemento: e.target.value }))} placeholder="Sala, Andar..." />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Bairro</Label>
                          <Input value={form.bairro} onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Cidade</Label>
                          <Input value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Estado</Label>
                          <Input value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))} placeholder="SP" maxLength={2} />
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-[#C0181A] hover:bg-[#a01416]" size="lg" disabled={!!cnpjError}>
                      Continuar para documentos <ChevronRight size={16} className="ml-1" />
                    </Button>
                  </form>
                </>
              )}

              {/* ─── ETAPA 2: upload de documentos ─────────────────────── */}
              {step === 2 && (
                <div className="space-y-5">
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                      <AlertCircle size={15} className="shrink-0" />{error}
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                    <p className="font-semibold mb-1">Por que precisamos dos documentos?</p>
                    <p className="text-xs leading-relaxed">
                      Para garantir a segurança do marketplace, verificamos os dados de todas as empresas antes de liberar o acesso.
                      O <strong>Cartão CNPJ</strong> é obrigatório. Os demais documentos agilizam a análise.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {tiposFiltrados.map((tipo) => (
                      <div key={tipo.value} className="relative">
                        <DocUploader
                          tipo={tipo.value}
                          label={`${tipo.label}${tipo.obrigatorio ? " *" : ""}`}
                          onAdd={addDocumento}
                          jaEnviado={docEnviado(tipo.value)}
                        />
                        {docEnviado(tipo.value) && (
                          <button
                            type="button"
                            onClick={() => removeDocumento(tipo.value)}
                            className="absolute top-2 right-2 w-5 h-5 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 text-xs text-muted-foreground">
                    <span className="font-medium">Documentos enviados:</span> {documentos.length} de {tiposFiltrados.length} disponíveis
                    {documentos.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {documentos.map((d) => (
                          <li key={d.tipo} className="flex items-center gap-1.5 text-green-700">
                            <CheckCircle2 size={10} />
                            {d.nome}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-1">
                      <ChevronLeft size={15} /> Voltar
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={registerMutation.isPending || !obrigatoriosOk}
                      className="flex-1 bg-[#C0181A] hover:bg-[#a01416]"
                      size="lg"
                    >
                      {registerMutation.isPending ? (
                        <><Loader2 size={16} className="animate-spin mr-2" />Criando conta...</>
                      ) : (
                        <>
                          <FileText size={16} className="mr-2" />
                          {role === "buyer" ? "Enviar para análise" : "Criar conta de fornecedor"}
                        </>
                      )}
                    </Button>
                  </div>

                  <p className="text-center text-xs text-muted-foreground">
                    Ao criar sua conta você concorda com os termos de uso da plataforma.
                  </p>
                </div>
              )}

              {step === 1 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Já tem conta?{" "}
                  <Link href="/login" className="text-[#C0181A] hover:underline font-medium">Entrar</Link>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Painel direito */}
      <div className="hidden lg:flex w-[380px] bg-gradient-to-br from-[#C0181A] to-[#E85D00] items-center justify-center p-12">
        <div className="text-white text-center">
          <div className="text-7xl mb-6">🏗️</div>
          <h2 className="text-2xl font-black mb-4 leading-tight">
            Marketplace B2B de materiais de construção
          </h2>
          <div className="flex flex-col gap-3 mt-6">
            {["Preços exclusivos PJ", "Compra em volume", "Cotação direta com fornecedor", "Entrega em todo Brasil"].map((f) => (
              <div key={f} className="flex items-center gap-2 text-white/90 text-sm">
                <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
