export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  // Set only by actions that generate a credential the admin must copy immediately (Criar
  // Fornecedor, redefinir senha, Usuários Internos) — never persisted in plaintext, shown once.
  generatedPassword?: string;
  // Set only by createDeliveryAddressAction, so the form can immediately offer a map to fine-tune
  // the geocoded pin (SPEC.md §10, LOG-03) without a full page reload.
  newAddressId?: string;
  newAddressCoordinates?: { lat: number; lng: number } | null;
};

export const INITIAL_FORM_STATE: FormState = { status: "idle" };
