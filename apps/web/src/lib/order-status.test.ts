import { describe, expect, it } from "vitest";
import { canTransition, isTerminalStatus, ORDER_STATUS_TRANSITIONS } from "./order-status";

describe("canTransition", () => {
  it("lets the system confirm payment", () => {
    expect(canTransition("aguardando_pagamento", "pago", "sistema")).toBe(true);
  });

  it("does not let a supplier confirm payment", () => {
    expect(canTransition("aguardando_pagamento", "pago", "fornecedor")).toBe(false);
  });

  it("walks a supplier through the happy path in order", () => {
    expect(canTransition("pago", "em_separacao", "fornecedor")).toBe(true);
    expect(canTransition("em_separacao", "enviado", "fornecedor")).toBe(true);
    expect(canTransition("enviado", "entregue", "fornecedor")).toBe(true);
  });

  it("does not let a supplier skip a step", () => {
    expect(canTransition("pago", "enviado", "fornecedor")).toBe(false);
  });

  it("lets a buyer cancel only before payment", () => {
    expect(canTransition("aguardando_pagamento", "cancelado", "comprador")).toBe(true);
    expect(canTransition("pago", "cancelado", "comprador")).toBe(false);
  });

  it("lets a buyer open a dispute after payment but not before", () => {
    expect(canTransition("pago", "em_disputa", "comprador")).toBe(true);
    expect(canTransition("aguardando_pagamento", "em_disputa", "comprador")).toBe(false);
  });

  it("lets admin override into any state reachable from the current one", () => {
    expect(canTransition("pago", "cancelado", "admin")).toBe(true);
    expect(canTransition("em_disputa", "devolvido", "admin")).toBe(true);
  });

  it("rejects transitions not defined in the state machine at all, even for admin", () => {
    expect(canTransition("cancelado", "pago", "admin")).toBe(false);
    expect(canTransition("aguardando_pagamento", "entregue", "admin")).toBe(false);
  });

  it("rejects transitioning a status to itself", () => {
    expect(canTransition("pago", "pago", "admin")).toBe(false);
  });
});

describe("isTerminalStatus", () => {
  it("flags cancelado and devolvido as terminal", () => {
    expect(isTerminalStatus("cancelado")).toBe(true);
    expect(isTerminalStatus("devolvido")).toBe(true);
  });

  it("does not flag active statuses as terminal", () => {
    expect(isTerminalStatus("aguardando_pagamento")).toBe(false);
    expect(isTerminalStatus("entregue")).toBe(false);
  });
});

describe("ORDER_STATUS_TRANSITIONS", () => {
  it("only references known statuses", () => {
    const known = Object.keys(ORDER_STATUS_TRANSITIONS);
    for (const targets of Object.values(ORDER_STATUS_TRANSITIONS)) {
      for (const target of targets) {
        expect(known).toContain(target);
      }
    }
  });
});
