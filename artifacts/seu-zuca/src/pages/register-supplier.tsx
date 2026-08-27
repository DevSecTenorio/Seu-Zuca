import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Store, CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLookupCep, getLookupCepQueryKey } from "@workspace/api-client-react";
import { DocUploader, Documento, DocTipo, formatCnpj, validateCnpj, formatCep } from "@/components/register-shared";

const DOC_TIPOS_SUPPLIER: { value: DocTipo; label: string; obrigatorio?: boolean }[] = [
  { value: "cartao_cnpj",          label: "Cartão CNPJ",                     obrigatorio: true },
  { value: "contrato_social",      label: "Contrato Social / Estatuto",       obrigatorio: true },
  { value: "alvara",               label: "Alvará de funcionamento" },
  { value: "identidade",           label: "RG ou CNH do responsável" },
  { value: "comprovante_endereco", label: "Comprovante de endereço" },
  { value: "outros",               label: "Outros documentos" },
];

export default function RegisterSupplier() {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    email: "", password: "", nome: "", cnpj: "", razaoSocial: "", nomeFantasia: "",
    telefone: "", ramo: "", cep: "", logradouro: "", numero: "", complemento: "",
    bairro: "", cidade: "", estado: "",
  });
  const [cnpjError, setCnpjError] = useState("");
  const [error, setError] = useState("");
  const [cepQuery, setCepQuery] = useState("");
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: cepData } = useLookupCep(cepQuery, { query: { queryKey: getLookupCepQueryKey(cepQuery), enabled: cepQuery.length === 8 } });

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
    if (!form.telefone.trim()) { setError("Telefone é obrigatório para fornecedores"); return; }
    if (!form.ramo.trim()) { setError("Ramo de atividade é obrigatório"); return; }
    setStep(2);
  }

  function addDocumento(doc: Documento) {
    setDocumentos((prev) => [...prev.filter((d) => d.tipo !== doc.tipo), doc]);
  }

  function removeDocumento(tipo: DocTipo) {
    setDocumentos((prev) => prev.filter((d) => d.tipo !== tipo));
  }

  async function handleSubmit() {
    setError("");
    const cartaoCnpj = documentos.find((d) => d.tipo === "cartao_cnpj");
    const contratoSocial = documentos.find((d) => d.tipo === "contrato_social");
    if (!cartaoCnpj) { setError("O Cartão CNPJ é obrigatório"); return; }
    if (!contratoSocial) { setError("O Contrato Social é obrigatório para fornecedores"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register/supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, cnpj: form.cnpj.replace(/\D/g, ""), documentos }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao criar conta");
      await queryClient.invalidateQueries();
      navigate("/cadastro/aguardando");
    } catch (err: unknown) {
      setError((err as Error).message || "Erro ao criar conta");
    } finally {
      setSubmitting(false);
    }
  }

  const docEnviado = (tipo: DocTipo) => documentos.some((d) => d.tipo === tipo);
  const obrigatoriosOk = DOC_TIPOS_SUPPLIER.filter((t) => t.obrigatorio).every((t) => docEnviado(t.value));

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">

          <Link href="/" className="flex items-center gap-4 mb-8">
            <div className="overflow-hidden flex items-center justify-center" style={{ width: 160, height: 56 }}>
              <img src="/logo-seuzuca.png" alt="Seu Zuca" style={{ transform: "scale(2.4)", transformOrigin: "center center", width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          </Link>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-5 text-sm text-muted-foreground">
            <Link href="/cadastro" className="hover:text-[#C0181A] transition-colors">Criar conta</Link>
            <ChevronRight size={13} />
            <span className="flex items-center gap-1.5 text-gray-700 font-medium">
              <Store size={14} className="text-emerald-600" /> Fornecedor
            </span>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-3 mb-6">
            {[{ n: 1, label: "Dados da empresa" }, { n: 2, label: "Documentos" }].map(({ n, label }, i, arr) => (
              <div key={n} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === n ? "bg-[#C0181A] text-white" : step > n ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"}`}>
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
              <CardTitle className="text-2xl">{step === 1 ? "Cadastro de Fornecedor" : "Documentos da empresa"}</CardTitle>
              <CardDescription>
                {step === 1 ? "Preencha os dados da sua empresa. Campos marcados com * são obrigatórios." : "Envie os documentos para análise e aprovação do cadastro"}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {step === 1 && (
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
                      <Label>Nome Fantasia *</Label>
                      <Input value={form.nomeFantasia} onChange={(e) => setForm((f) => ({ ...f, nomeFantasia: e.target.value }))} placeholder="Como sua loja será exibida" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nome do responsável *</Label>
                      <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="João Silva" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Ramo de atividade *</Label>
                      <Input value={form.ramo} onChange={(e) => setForm((f) => ({ ...f, ramo: e.target.value }))} placeholder="Ex: Materiais de Construção" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Telefone *</Label>
                      <Input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} placeholder="(11) 98888-7777" required />
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
                    <h3 className="font-medium mb-3 text-sm text-gray-600">Endereço do estabelecimento</h3>
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
                        <Input value={form.complemento} onChange={(e) => setForm((f) => ({ ...f, complemento: e.target.value }))} placeholder="Sala, Galpão..." />
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

                  <p className="text-center text-sm text-muted-foreground">
                    Já tem conta? <Link href="/login" className="text-[#C0181A] hover:underline font-medium">Entrar</Link>
                  </p>
                </form>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                      <AlertCircle size={15} className="shrink-0" />{error}
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                    <p className="font-semibold mb-1">Documentos obrigatórios para fornecedores</p>
                    <p className="text-xs leading-relaxed">
                      Fornecedores precisam enviar o <strong>Cartão CNPJ</strong> e o <strong>Contrato Social</strong> para análise.
                      Os demais documentos são opcionais mas aceleram a aprovação.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {DOC_TIPOS_SUPPLIER.map((tipo) => (
                      <div key={tipo.value} className="relative">
                        <DocUploader tipo={tipo.value} label={`${tipo.label}${tipo.obrigatorio ? " *" : ""}`} onAdd={addDocumento} jaEnviado={docEnviado(tipo.value)} />
                        {docEnviado(tipo.value) && (
                          <button type="button" onClick={() => removeDocumento(tipo.value)} className="absolute top-2 right-2 w-5 h-5 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors">
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 text-xs text-muted-foreground">
                    <span className="font-medium">Documentos enviados:</span> {documentos.length} de {DOC_TIPOS_SUPPLIER.length} disponíveis
                    {documentos.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {documentos.map((d) => (
                          <li key={d.tipo} className="flex items-center gap-1.5 text-green-700">
                            <CheckCircle2 size={10} />{d.nome}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-1">
                      <ChevronLeft size={15} /> Voltar
                    </Button>
                    <Button type="button" onClick={handleSubmit} disabled={submitting || !obrigatoriosOk} className="flex-1 bg-[#C0181A] hover:bg-[#a01416]" size="lg">
                      {submitting ? <><Loader2 size={16} className="animate-spin mr-2" />Criando conta...</> : <><FileText size={16} className="mr-2" />Enviar para análise</>}
                    </Button>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">Ao criar sua conta você concorda com os termos de uso da plataforma.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="hidden lg:flex w-[380px] bg-gradient-to-br from-emerald-600 to-emerald-800 items-center justify-center p-12">
        <div className="text-white text-center">
          <div className="text-7xl mb-6">🏪</div>
          <h2 className="text-2xl font-black mb-4 leading-tight">Cadastro de Fornecedor</h2>
          <div className="flex flex-col gap-3 mt-6">
            {["Vitrine para milhares de compradores PJ", "Gestão completa de produtos e pedidos", "Repasse automático de comissões", "Suporte dedicado ao fornecedor"].map((f) => (
              <div key={f} className="flex items-center gap-2 text-white/90 text-sm">
                <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                {f}
              </div>
            ))}
          </div>
          <p className="text-white/70 text-xs mt-6">Sua conta será analisada pela equipe em até 1 dia útil.</p>
        </div>
      </div>
    </div>
  );
}
