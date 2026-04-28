import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Store, ChevronRight } from "lucide-react";

export default function Register() {
  return (
    <div className="min-h-screen bg-[#f5f5f5] flex">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <Link href="/" className="flex items-center gap-4 mb-8">
            <div className="overflow-hidden flex items-center justify-center" style={{ width: 160, height: 56 }}>
              <img
                src="/logo-seuzuca.png"
                alt="Seu Zuca"
                style={{ transform: "scale(2.4)", transformOrigin: "center center", width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
          </Link>

          <Card className="border-border shadow-sm">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl">Criar conta B2B</CardTitle>
              <CardDescription>
                Plataforma exclusiva para Pessoas Jurídicas com CNPJ ativo. Selecione o tipo de conta que deseja criar.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <Link href="/cadastro/comprador">
                <div className="flex items-center gap-4 p-5 rounded-xl border-2 border-border hover:border-[#C0181A] hover:bg-red-50/30 cursor-pointer transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                    <Building2 size={24} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Comprador</p>
                    <p className="text-sm text-muted-foreground">Construtoras, empreiteiras e empresas do setor</p>
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground group-hover:text-[#C0181A] transition-colors" />
                </div>
              </Link>

              <Link href="/cadastro/fornecedor">
                <div className="flex items-center gap-4 p-5 rounded-xl border-2 border-border hover:border-[#C0181A] hover:bg-red-50/30 cursor-pointer transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                    <Store size={24} className="text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Fornecedor</p>
                    <p className="text-sm text-muted-foreground">Lojas, distribuidoras e fabricantes de materiais</p>
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground group-hover:text-[#C0181A] transition-colors" />
                </div>
              </Link>

              <p className="text-center text-sm text-muted-foreground pt-2">
                Já tem conta?{" "}
                <Link href="/login" className="text-[#C0181A] hover:underline font-medium">Entrar</Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

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
