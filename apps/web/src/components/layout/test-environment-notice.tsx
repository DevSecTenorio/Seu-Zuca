"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "seu-zuca:test-environment-notice-dismissed";

export function TestEnvironmentNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  function handleDismiss() {
    setOpen(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore storage errors (private browsing, etc.)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 shrink-0 text-amber-500" aria-hidden="true" />
            <DialogTitle>Ambiente de testes</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            Esta é uma base de dados de <strong>testes</strong> do Seu Zuca. Cadastros,
            pedidos, pagamentos e demais informações aqui inseridos não são reais e podem
            ser apagados ou reiniciados a qualquer momento, sem aviso prévio.
            <br />
            <br />
            Este aviso é exibido para todos os perfis de acesso (administrador, suporte,
            fornecedor, comprador e visitante). Não utilize dados reais de clientes,
            documentos ou informações sensíveis nesta versão.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleDismiss}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
