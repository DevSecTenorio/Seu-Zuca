import { useRef } from "react";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";
import { useToast } from "@/hooks/use-toast";

export type DocTipo = "cartao_cnpj" | "contrato_social" | "identidade" | "comprovante_endereco" | "alvara" | "outros";
export interface Documento { tipo: DocTipo; nome: string; url: string; nomeArquivo: string; }

export function formatCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

export function validateCnpj(cnpj: string) {
  const c = cnpj.replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const d = (digits: string, w: number[]) => { const s = digits.split("").reduce((a, x, i) => a + +x * w[i], 0); const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return +c[12] === d(c.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]) && +c[13] === d(c.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]);
}

export function formatCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d)/, "$1-$2");
}

export function DocUploader({ tipo, label, onAdd, jaEnviado }: {
  tipo: DocTipo; label: string;
  onAdd: (doc: Documento) => void;
  jaEnviado: boolean;
}) {
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res) => {
      onAdd({ tipo, nome: label, url: res.objectPath, nomeArquivo: res.objectPath.split("/").pop() || label });
      toast({ title: `${label} enviado!` });
    },
    onError: (err) => toast({ title: err.message || "Erro ao enviar", variant: "destructive" }),
  });

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) { toast({ title: "Arquivo maior que 10 MB", variant: "destructive" }); return; }
    await uploadFile(file);
    if (ref.current) ref.current.value = "";
  }

  return (
    <div
      className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
        jaEnviado ? "border-green-300 bg-green-50" : "border-dashed border-gray-200 hover:border-[#C0181A]/50 hover:bg-red-50/20"
      }`}
      onClick={() => !isUploading && !jaEnviado && ref.current?.click()}
    >
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      {jaEnviado ? (
        <CheckCircle2 size={20} className="text-green-500 shrink-0" />
      ) : isUploading ? (
        <Loader2 size={20} className="text-[#C0181A] animate-spin shrink-0" />
      ) : (
        <UploadCloud size={20} className="text-gray-400 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${jaEnviado ? "text-green-700" : "text-gray-700"}`}>{label}</p>
        {isUploading ? (
          <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
            <div className="bg-[#C0181A] h-1 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{jaEnviado ? "Enviado ✓" : "PDF, JPG ou PNG — máx. 10 MB"}</p>
        )}
      </div>
    </div>
  );
}
