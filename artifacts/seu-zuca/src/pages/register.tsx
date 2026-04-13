import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useRegisterUser, useLookupCep } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertCircle, Building2, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function validateCnpj(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  const calcDigit = (digits: string, weights: number[]) => {
    const sum = digits.split("").reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const d1 = calcDigit(cleaned.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcDigit(cleaned.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return parseInt(cleaned[12]) === d1 && parseInt(cleaned[13]) === d2;
}

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, "$1-$2");
}

export default function Register() {
  const [role, setRole] = useState<"buyer" | "supplier">("buyer");
  const [form, setForm] = useState({
    email: "", password: "", nome: "", cnpj: "", razaoSocial: "", nomeFantasia: "",
    telefone: "", ramo: "", cep: "", logradouro: "", numero: "", complemento: "",
    bairro: "", cidade: "", estado: "",
  });
  const [cnpjError, setCnpjError] = useState("");
  const [error, setError] = useState("");
  const [cepQuery, setCepQuery] = useState("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const registerMutation = useRegisterUser();
  const { toast } = useToast();
  const { data: cepData } = useLookupCep(cepQuery, { query: { enabled: cepQuery.length === 8 } });

  if (cepData && !form.logradouro) {
    setForm((f) => ({
      ...f,
      logradouro: (cepData as { logradouro?: string }).logradouro || f.logradouro,
      bairro: (cepData as { bairro?: string }).bairro || f.bairro,
      cidade: (cepData as { cidade?: string }).cidade || f.cidade,
      estado: (cepData as { estado?: string }).estado || f.estado,
    }));
  }

  function handleCnpjChange(value: string) {
    const formatted = formatCnpj(value);
    setForm((f) => ({ ...f, cnpj: formatted }));
    const cleaned = formatted.replace(/\D/g, "");
    if (cleaned.length === 14) {
      setCnpjError(validateCnpj(cleaned) ? "" : "CNPJ inválido");
    } else {
      setCnpjError("");
    }
  }

  function handleCepChange(value: string) {
    const formatted = formatCep(value);
    setForm((f) => ({ ...f, cep: formatted, logradouro: "", bairro: "", cidade: "", estado: "" }));
    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 8) setCepQuery(digits);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!validateCnpj(form.cnpj)) {
      setError("CNPJ inválido");
      return;
    }

    try {
      await registerMutation.mutateAsync({ data: { ...form, role, cnpj: form.cnpj.replace(/\D/g, "") } });
      await queryClient.invalidateQueries();
      if (role === "buyer") {
        navigate("/cadastro/aguardando");
      } else {
        toast({ title: "Conta de fornecedor criada com sucesso!" });
        navigate("/fornecedor/painel");
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao criar conta";
      setError(message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl">
            <div className="w-10 h-10 bg-[hsl(220,35%,14%)] rounded-lg flex items-center justify-center">
              <Package className="text-[hsl(25,95%,53%)]" size={20} />
            </div>
            <span>Seu Zuca</span>
          </Link>
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Criar conta B2B</CardTitle>
            <CardDescription>Plataforma exclusiva para Pessoas Jurídicas</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Role selection */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => setRole("buyer")}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${role === "buyer" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                <Building2 size={24} className={role === "buyer" ? "text-primary" : "text-muted-foreground"} />
                <span className="text-sm font-medium">Comprador</span>
                <span className="text-xs text-muted-foreground text-center">Construtoras, empreiteiras</span>
              </button>
              <button
                type="button"
                onClick={() => setRole("supplier")}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${role === "supplier" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                <Store size={24} className={role === "supplier" ? "text-primary" : "text-muted-foreground"} />
                <span className="text-sm font-medium">Fornecedor</span>
                <span className="text-xs text-muted-foreground text-center">Lojas e distribuidoras</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CNPJ *</Label>
                  <Input value={form.cnpj} onChange={(e) => handleCnpjChange(e.target.value)} placeholder="00.000.000/0000-00" required />
                  {cnpjError && <p className="text-xs text-destructive">{cnpjError}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Razão Social *</Label>
                  <Input value={form.razaoSocial} onChange={(e) => setForm((f) => ({ ...f, razaoSocial: e.target.value }))} placeholder="Empresa LTDA" required />
                </div>
                <div className="space-y-2">
                  <Label>Nome Fantasia</Label>
                  <Input value={form.nomeFantasia} onChange={(e) => setForm((f) => ({ ...f, nomeFantasia: e.target.value }))} placeholder="Nome comercial" />
                </div>
                <div className="space-y-2">
                  <Label>Nome do responsável *</Label>
                  <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="João Silva" required />
                </div>
                <div className="space-y-2">
                  <Label>Ramo de atividade</Label>
                  <Input value={form.ramo} onChange={(e) => setForm((f) => ({ ...f, ramo: e.target.value }))} placeholder="Ex: Construção Civil" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} placeholder="(11) 98888-7777" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="contato@empresa.com.br" required />
                </div>
                <div className="space-y-2">
                  <Label>Senha *</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" required minLength={8} />
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-4">
                <h3 className="font-medium mb-3 text-sm">Endereço</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input value={form.cep} onChange={(e) => handleCepChange(e.target.value)} placeholder="00000-000" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Logradouro</Label>
                    <Input value={form.logradouro} onChange={(e) => setForm((f) => ({ ...f, logradouro: e.target.value }))} placeholder="Rua, Avenida..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} placeholder="123" />
                  </div>
                  <div className="space-y-2">
                    <Label>Complemento</Label>
                    <Input value={form.complemento} onChange={(e) => setForm((f) => ({ ...f, complemento: e.target.value }))} placeholder="Sala, Andar..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input value={form.bairro} onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))} placeholder="SP" maxLength={2} />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={registerMutation.isPending || !!cnpjError}>
                {registerMutation.isPending ? "Criando conta..." : "Criar conta B2B"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Já tem conta?{" "}
              <Link href="/login" className="text-primary hover:underline">Entrar</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
