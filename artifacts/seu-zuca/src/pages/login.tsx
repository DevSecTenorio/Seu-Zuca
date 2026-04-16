import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLoginUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const loginMutation = useLoginUser();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await loginMutation.mutateAsync({ data: { email, password } });
      await queryClient.invalidateQueries();
      toast({ title: "Login realizado com sucesso!" });
      navigate("/");
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "E-mail ou senha incorretos";
      setError(message);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex">
      {/* Left panel - form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 mb-8">
            <div className="w-[72px] h-[48px] bg-[#C0181A] rounded-lg flex flex-col items-center justify-center px-2">
              <span className="text-white font-black text-[16px] leading-none tracking-tight">SEU</span>
              <span className="text-white font-black text-[16px] leading-none tracking-tight">ZUCA</span>
              <span className="text-[#FFD700] text-[6px] font-semibold tracking-wide">PEDIU, CHEGOU</span>
            </div>
            <div>
              <p className="font-bold text-gray-800 text-lg leading-tight">Seja bem-vindo!</p>
              <p className="text-gray-500 text-sm">Plataforma B2B de materiais de construção</p>
            </div>
          </Link>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Entrar na plataforma</h1>
            <p className="text-gray-500 text-sm mb-6">Acesse com o e-mail da sua empresa</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                  <AlertCircle size={15} className="shrink-0" />
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-gray-700 font-medium text-sm">E-mail corporativo</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="empresa@exemplo.com.br"
                  required
                  className="h-11 border-gray-200 focus:border-[#C0181A] focus:ring-[#C0181A]/20"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-gray-700 font-medium text-sm">Senha</Label>
                  <Link href="/" className="text-xs text-[#C0181A] hover:underline">Esqueceu a senha?</Link>
                </div>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    required
                    className="h-11 border-gray-200 pr-10 focus:border-[#C0181A] focus:ring-[#C0181A]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full bg-[#C0181A] hover:bg-[#a01416] text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-60 text-base mt-2"
              >
                {loginMutation.isPending ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Ainda não tem conta?{" "}
                <Link href="/cadastro" className="text-[#C0181A] font-semibold hover:underline">
                  Cadastre sua empresa
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            Plataforma exclusiva para Pessoas Jurídicas com CNPJ ativo
          </p>
        </div>
      </div>

      {/* Right panel - illustration */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#C0181A] to-[#E85D00] items-center justify-center p-12">
        <div className="text-white text-center max-w-sm">
          <div className="text-8xl mb-6">🏗️</div>
          <h2 className="text-3xl font-black mb-4 leading-tight">
            Materiais de construção para sua empresa
          </h2>
          <p className="text-white/80 text-base leading-relaxed">
            Acesse preços exclusivos de atacado, solicite cotações e faça pedidos em volume diretamente com os melhores fornecedores do Brasil.
          </p>
          <div className="flex flex-col gap-3 mt-8">
            {["Preços exclusivos PJ", "Compra em volume", "Sistema de cotação", "Entrega em todo Brasil"].map((f) => (
              <div key={f} className="flex items-center gap-2 text-white/90 text-sm">
                <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">✓</span>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
