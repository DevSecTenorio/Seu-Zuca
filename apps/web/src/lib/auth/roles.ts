export type Role = "admin" | "suporte" | "fornecedor" | "comprador";
export type UserStatus = "pendente" | "aprovado" | "rejeitado" | "suspenso";

/** Where each role lands after login / when hitting a route it's not allowed on. */
export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  suporte: "/suporte",
  fornecedor: "/fornecedor/painel",
  comprador: "/",
};

/**
 * Where the "Meu painel" link in the account menu points. Distinct from ROLE_HOME
 * because comprador's home is the public storefront ("/"), not a personal dashboard —
 * reusing ROLE_HOME there made the buyer's panel link land on the homepage with no
 * account info, which looked like the link did nothing.
 */
export const ROLE_PANEL: Record<Role, string> = {
  ...ROLE_HOME,
  comprador: "/minha-conta",
};
