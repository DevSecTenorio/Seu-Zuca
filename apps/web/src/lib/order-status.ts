export type OrderStatus =
  | "aguardando_pagamento"
  | "pago"
  | "em_separacao"
  | "enviado"
  | "entregue"
  | "cancelado"
  | "em_disputa"
  | "devolvido";

export type OrderActor = "sistema" | "fornecedor" | "comprador" | "admin";

/**
 * Order state machine (SPEC.md §5): aguardando_pagamento -> pago -> em_separacao -> enviado ->
 * entregue is the happy path; cancelado/em_disputa/devolvido are branches. Terminal states
 * (cancelado, devolvido) have no outgoing transitions.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  aguardando_pagamento: ["pago", "cancelado"],
  pago: ["em_separacao", "cancelado", "em_disputa"],
  em_separacao: ["enviado", "cancelado", "em_disputa"],
  enviado: ["entregue", "em_disputa", "devolvido"],
  entregue: ["em_disputa", "devolvido"],
  em_disputa: ["cancelado", "devolvido", "entregue"],
  cancelado: [],
  devolvido: [],
};

/** Who is allowed to *trigger* each transition. Admin can always override (SPEC.md §7: "acesso
 * total"), so it's implicitly allowed everywhere and omitted from each entry below. */
const ACTOR_ALLOWED_TRANSITIONS: Record<OrderActor, Partial<Record<OrderStatus, OrderStatus[]>>> = {
  sistema: {
    // Mercado Pago webhook confirming payment.
    aguardando_pagamento: ["pago"],
  },
  fornecedor: {
    pago: ["em_separacao"],
    em_separacao: ["enviado"],
    enviado: ["entregue"],
  },
  comprador: {
    // Buyers can only cancel before paying, or open a dispute at any post-payment stage.
    aguardando_pagamento: ["cancelado"],
    pago: ["em_disputa"],
    em_separacao: ["em_disputa"],
    enviado: ["entregue", "em_disputa"],
    entregue: ["em_disputa"],
  },
  admin: {},
};

export function canTransition(from: OrderStatus, to: OrderStatus, actor: OrderActor): boolean {
  if (!ORDER_STATUS_TRANSITIONS[from].includes(to)) return false;
  if (actor === "admin") return true;
  return ACTOR_ALLOWED_TRANSITIONS[actor][from]?.includes(to) ?? false;
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[status].length === 0;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  em_separacao: "Em separação",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
  em_disputa: "Em disputa",
  devolvido: "Devolvido",
};
