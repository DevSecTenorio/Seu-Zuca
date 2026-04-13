import { Link } from "wouter";
import { useListCategories, useListProducts } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Truck, Shield, Building2, HardHat, Wrench } from "lucide-react";

export default function Home() {
  const { data: categories } = useListCategories();
  const { data: productsData } = useListProducts({ limit: 6 });

  return (
    <Layout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-[hsl(220,35%,14%)] to-[hsl(220,40%,20%)] text-white py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <Badge className="mb-4 bg-[hsl(25,95%,53%)] text-white border-0 text-sm px-4 py-1">
            Plataforma Exclusiva B2B
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Materiais de Construção<br />
            <span className="text-[hsl(25,95%,53%)]">em Grande Volume</span>
          </h1>
          <p className="text-xl text-[hsl(210,20%,75%)] mb-8 max-w-2xl mx-auto">
            Conectamos construtoras, empreiteiras e engenheiros com os melhores fornecedores do Brasil.
            Preços exclusivos para Pessoa Jurídica.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/cadastro">
              <Button size="lg" className="bg-[hsl(25,95%,53%)] hover:bg-[hsl(25,95%,45%)] text-white border-0 text-base px-8">
                Criar conta B2B
              </Button>
            </Link>
            <Link href="/catalogo">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-base px-8">
                Ver Catálogo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Lock className="text-primary" size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2">Preços Exclusivos PJ</h3>
              <p className="text-muted-foreground text-sm">Preços e condições de pagamento visíveis apenas para empresas cadastradas e aprovadas.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Truck className="text-accent" size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2">Compras em Volume</h3>
              <p className="text-muted-foreground text-sm">Quantidades mínimas por categoria para garantir os melhores preços no atacado.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="text-green-600" size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2">Pagamento Seguro</h3>
              <p className="text-muted-foreground text-sm">Checkout protegido com split automático via Stripe Connect para múltiplos fornecedores.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories && categories.length > 0 && (
        <section className="py-16 px-4 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Categorias em Destaque</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {categories.slice(0, 4).map((cat) => (
                <Link key={cat.id} href={`/catalogo?categoryId=${cat.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer border-border">
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                        <Building2 className="text-primary" size={20} />
                      </div>
                      <p className="font-semibold text-sm">{cat.nome}</p>
                      <p className="text-xs text-muted-foreground mt-1">{cat.unidadeMedida}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Products preview */}
      {productsData?.products && productsData.products.length > 0 && (
        <section className="py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Produtos Disponíveis</h2>
              <Link href="/catalogo">
                <Button variant="outline" size="sm">Ver todos</Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {productsData.products.map((product) => (
                <Link key={product.id} href={`/produto/${product.slug || product.id}`}>
                  <Card className="hover:shadow-md transition-all cursor-pointer border-border group">
                    <div className="aspect-video bg-muted rounded-t-lg overflow-hidden">
                      {product.imagemPrincipal ? (
                        <img
                          src={product.imagemPrincipal}
                          alt={product.nome}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <HardHat size={40} />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">{product.categoryName}</p>
                      <h3 className="font-semibold text-sm line-clamp-2 mb-2">{product.nome}</h3>
                      <div className="flex items-center justify-between">
                        <Badge variant={product.disponivel ? "default" : "secondary"} className="text-xs">
                          {product.disponivel ? "Disponível" : "Indisponível"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{product.supplierName}</span>
                      </div>
                      <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                        <Lock size={10} />
                        Faça login para ver o preço
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA - Who is it for */}
      <section className="py-16 px-4 bg-[hsl(220,35%,14%)] text-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Para quem é o Seu Zuca?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Building2, title: "Construtoras", desc: "Compre materiais em grandes volumes com preços de atacado e entrega direto na obra." },
              { icon: HardHat, title: "Empreiteiras", desc: "Gerencie pedidos de múltiplas obras em um só lugar. Sistema de cotação integrado." },
              { icon: Wrench, title: "Engenheiros e Arquitetos", desc: "Acesse o catálogo completo, solicite cotações e acompanhe seus pedidos." },
            ].map((item) => (
              <div key={item.title} className="text-center p-6">
                <div className="w-14 h-14 bg-[hsl(25,95%,53%)] rounded-xl flex items-center justify-center mx-auto mb-4">
                  <item.icon size={24} />
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-[hsl(210,20%,70%)] text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/cadastro">
              <Button size="lg" className="bg-[hsl(25,95%,53%)] hover:bg-[hsl(25,95%,45%)] text-white border-0 text-base px-8">
                Criar conta gratuitamente
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
