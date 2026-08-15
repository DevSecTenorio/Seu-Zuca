export type Role = "admin" | "suporte" | "fornecedor" | "comprador";
export type UserStatus = "pendente" | "aprovado" | "rejeitado" | "suspenso";

/** Where each role lands after login / when hitting a route it's not allowed on. */
export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  suporte: "/suporte",
  fornecedor: "/fornecedor/painel",
  comprador: "/",
};
