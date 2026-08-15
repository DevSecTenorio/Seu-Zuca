"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const TYPE_LABELS: Record<string, string> = {
  cartao_cnpj: "Cartão CNPJ",
  contrato_social: "Contrato social",
  outro: "Outro documento",
};

export function KycDocumentsDialog({
  companyName,
  documents,
}: {
  companyName: string;
  documents: { id: string; type: string; fileName: string; fileUrl: string; uploadedAt: Date }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <FileText className="size-4" /> Documentos
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Documentos de {companyName}</DialogTitle>
        </DialogHeader>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{TYPE_LABELS[doc.type] ?? doc.type}</p>
                  <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={doc.fileUrl} target="_blank" rel="noreferrer">
                    Ver
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
