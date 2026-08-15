import { NextResponse, type NextRequest } from "next/server";
import { getRoleStatusForToken, SESSION_COOKIE } from "@/lib/auth/session-core";
import { ROLE_HOME, type Role } from "@/lib/auth/roles";

const GUEST_ONLY_ROUTES = new Set(["/login", "/cadastro", "/cadastro/comprador", "/cadastro/fornecedor"]);

const ADMIN_PREFIX = "/admin";
const SUPORTE_PREFIX = "/suporte";
const FORNECEDOR_PREFIXES = ["/fornecedor/painel", "/fornecedor/produtos"];
const COMPRADOR_PREFIXES = [
  "/checkout",
  "/pagamento",
  "/pedidos",
  "/favoritos",
  "/minha-conta",
];
/** Reachable by any authenticated non-blocked role — the page itself explains that
 * non-buyer roles don't have a shopping cart (CLAUDE.md). */
const SHARED_AUTHENTICATED_PREFIXES = ["/carrinho"];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await getRoleStatusForToken(token) : null;

  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));

  // Blocked accounts: everywhere except the pages that explain the block and logout.
  if (session && (session.status === "suspenso" || session.status === "rejeitado")) {
    if (pathname !== "/conta-bloqueada") return redirectTo("/conta-bloqueada");
  }

  if (pathname === "/conta-bloqueada") {
    if (!session) return redirectTo("/login");
    if (session.status !== "suspenso" && session.status !== "rejeitado") {
      return redirectTo(ROLE_HOME[session.role as Role]);
    }
    return NextResponse.next();
  }

  if (pathname === "/aguardando-aprovacao") {
    if (!session) return redirectTo("/login");
    if (session.status === "aprovado") return redirectTo(ROLE_HOME[session.role as Role]);
    if (session.status === "suspenso" || session.status === "rejeitado") {
      return redirectTo("/conta-bloqueada");
    }
    return NextResponse.next();
  }

  // Pending buyers/suppliers can only see the waiting screen until approved.
  if (session && session.status === "pendente") {
    return redirectTo("/aguardando-aprovacao");
  }

  if (GUEST_ONLY_ROUTES.has(pathname) && session && session.status === "aprovado") {
    return redirectTo(ROLE_HOME[session.role as Role]);
  }

  if (matchesPrefix(pathname, [ADMIN_PREFIX])) {
    if (!session) return redirectTo("/login");
    if (session.role !== "admin") return redirectTo(ROLE_HOME[session.role as Role]);
  }

  if (matchesPrefix(pathname, [SUPORTE_PREFIX])) {
    if (!session) return redirectTo("/login");
    if (session.role !== "suporte") return redirectTo(ROLE_HOME[session.role as Role]);
  }

  if (matchesPrefix(pathname, FORNECEDOR_PREFIXES)) {
    if (!session) return redirectTo("/login");
    if (session.role !== "fornecedor") return redirectTo(ROLE_HOME[session.role as Role]);
  }

  if (matchesPrefix(pathname, COMPRADOR_PREFIXES)) {
    if (!session) return redirectTo("/login");
    if (session.role !== "comprador") return redirectTo(ROLE_HOME[session.role as Role]);
  }

  if (matchesPrefix(pathname, SHARED_AUTHENTICATED_PREFIXES) && !session) {
    return redirectTo("/login");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
