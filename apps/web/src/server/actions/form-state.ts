export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  // Set only by actions that generate a credential the admin must copy immediately (Criar
  // Fornecedor, redefinir senha, Usuários Internos) — never persisted in plaintext, shown once.
  generatedPassword?: string;
};

export const INITIAL_FORM_STATE: FormState = { status: "idle" };
