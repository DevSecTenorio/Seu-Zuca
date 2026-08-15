import Link from "next/link";
import { listTopLevelActiveCategories } from "@/server/actions/category-actions";

export async function Footer() {
  const year = new Date().getFullYear();
  const categories = await listTopLevelActiveCategories();

  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              SZ
            </span>
            <span className="text-lg font-semibold text-foreground">Seu Zuca</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Marketplace B2B de materiais de construção. Conectamos fornecedores e construtoras em
            todo o Brasil, exclusivo para pessoas jurídicas.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Institucional</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/quem-somos" className="hover:text-foreground">
                Quem somos
              </Link>
            </li>
            <li>
              <Link href="/como-funciona" className="hover:text-foreground">
                Como funciona
              </Link>
            </li>
            <li>
              <Link href="/seja-fornecedor" className="hover:text-foreground">
                Seja um fornecedor
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Categorias</h3>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {categories.slice(0, 6).map((category) => (
              <li key={category.slug}>
                <Link href={`/catalogo?categoria=${category.slug}`} className="hover:text-foreground">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Minha conta</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/login" className="hover:text-foreground">
                Entrar
              </Link>
            </li>
            <li>
              <Link href="/cadastro" className="hover:text-foreground">
                Criar conta B2B
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto max-w-7xl px-4 py-4 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
          © {year} Seu Zuca. Todos os direitos reservados. Plataforma exclusiva para pessoas
          jurídicas (CNPJ ativo).
        </div>
      </div>
    </footer>
  );
}
