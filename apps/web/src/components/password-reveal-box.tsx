"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Shown exactly once after an admin-issued credential is generated (Criar Fornecedor, Usuários
 * Internos, redefinir senha) — the password only ever exists in this response, never logged or
 * persisted in plaintext, so there is no "view again" later. */
export function PasswordRevealBox({ password }: { password: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3">
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertDescription>
          Esta senha não poderá ser recuperada depois de fechar esta janela. Copie e repasse ao
          responsável por um canal seguro agora.
        </AlertDescription>
      </Alert>
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
        <code className="flex-1 text-sm font-medium">{password}</code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(password);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  );
}
