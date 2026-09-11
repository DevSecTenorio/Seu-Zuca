export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export function validateDocumentFile(file: File | null, { required }: { required: boolean }): string | null {
  if (!file || file.size === 0) {
    return required ? "Envie este documento." : null;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Arquivo muito grande. O tamanho máximo é 10MB.";
  }
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
    return "Formato inválido. Envie PDF, PNG, JPG ou WEBP.";
  }
  return null;
}

/** Nota fiscal is always a formal PDF (DANFE) — narrower than the general KYC document types. */
export function validateInvoiceFile(file: File | null, { required }: { required: boolean }): string | null {
  if (!file || file.size === 0) {
    return required ? "Envie a nota fiscal." : null;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Arquivo muito grande. O tamanho máximo é 10MB.";
  }
  if (file.type !== "application/pdf") {
    return "Formato inválido. Envie um PDF.";
  }
  return null;
}
