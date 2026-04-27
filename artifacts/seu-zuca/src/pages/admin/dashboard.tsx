import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useGetDashboardStats, useAdminListUsers, useAdminApproveUser, useAdminSuspendUser, useListCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import ReportTab from "@/components/ReportTab";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, Package, ShoppingBag, TrendingUp, CheckCircle, XCircle,
  Clock, UserPlus, LayoutDashboard, AlertCircle, Eye, EyeOff, RefreshCw,
  ImageIcon, Plus, Trash2, Edit2, GripVertical, ExternalLink, ToggleLeft, ToggleRight,
  ShieldCheck, Headphones, UploadCloud, X as XIcon, Link as LinkIcon, FolderOpen, Tag, Star, Percent, ListOrdered, KeyRound, Copy, CheckCheck, BarChart2, FileText, Download
} from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";
import { useToast } from "@/hooks/use-toast";

const roleLabel: Record<string, string> = { admin: "Admin", buyer: "Comprador", supplier: "Fornecedor", support: "Suporte" };
const OWNER_EMAIL = "admin@seuzuca.com.br";
const statusLabel: Record<string, string> = { pending: "Pendente", approved: "Aprovado", rejected: "Recusado", suspended: "Suspenso" };
const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  suspended: "outline",
};

type UserDocumento = { tipo: string; nome: string; url: string; nomeArquivo?: string; };
type UserType = {
  id?: number;
  nome?: string;
  email?: string;
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  role?: string;
  status?: string;
  createdAt?: string;
  documentos?: UserDocumento[];
};

function formatCnpj(cnpj: string) {
  const c = cnpj.replace(/\D/g, "");
  return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ─── Aba: Usuários Internos (Admin / Suporte) ─────────────────────────────────
type InternalUser = { id: number; nome: string; email: string; role: string; status: string; ramo?: string | null; createdAt: string; ultimoAcesso?: string | null };

const ROLE_INTERNAL_LABEL: Record<string, string> = { admin: "Administrador", support: "Suporte" };
const EMPTY_INTERNAL = { nome: "", email: "", password: "", role: "support", departamento: "" };

const ROLE_OPTIONS = [
  { value: "support", label: "Suporte", icon: Headphones, desc: "Analisa fornecedores. Sem alterar configurações." },
  { value: "admin",   label: "Administrador", icon: ShieldCheck, desc: "Acesso total ao sistema. Use com cautela." },
] as const;

function RoleSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ROLE_OPTIONS.map((opt) => (
        <button
          key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 text-left transition-all ${
            value === opt.value ? "border-[#C0181A] bg-red-50" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <opt.icon size={14} className={value === opt.value ? "text-[#C0181A]" : "text-gray-500"} />
            <span className={`text-sm font-semibold ${value === opt.value ? "text-[#C0181A]" : "text-gray-700"}`}>{opt.label}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-tight">{opt.desc}</p>
        </button>
      ))}
    </div>
  );
}

function PasswordField({ value, onChange, placeholder = "Mínimo 8 caracteres", label, required }: {
  value: string; onChange: (v: string) => void; placeholder?: string; label: string; required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}{required && <span className="text-red-500"> *</span>}</Label>
        <button type="button" onClick={() => onChange(generatePassword())} className="text-xs text-[#E85D00] hover:underline">Gerar senha segura</button>
      </div>
      <div className="relative">
        <Input type={show ? "text" : "password"} placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value)} className="pr-10 font-mono" />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: InternalUser; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ nome: user.nome, email: user.email, role: user.role, departamento: user.ramo ?? "", password: "" });
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.email) { toast({ title: "Nome e e-mail são obrigatórios", variant: "destructive" }); return; }
    if (form.password && form.password.length < 8) { toast({ title: "Senha deve ter pelo menos 8 caracteres", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const body: Record<string, string> = { nome: form.nome, email: form.email, role: form.role, departamento: form.departamento };
      if (form.password) body.password = form.password;
      const r = await fetch(`/api/admin/internal-users/${user.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message || "Erro ao salvar"); }
      toast({ title: "Usuário atualizado com sucesso!" });
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const r = await fetch(`/api/admin/internal-users/${user.id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message || "Erro ao excluir"); }
      toast({ title: "Usuário excluído" });
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro", variant: "destructive" });
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto z-10">
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between rounded-t-2xl sm:rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${user.role === "admin" ? "bg-red-100" : "bg-blue-100"}`}>
              {user.role === "admin" ? <ShieldCheck size={14} className="text-[#C0181A]" /> : <Headphones size={14} className="text-blue-600" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Editar usuário</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Papel <span className="text-red-500">*</span></Label>
            <RoleSelector value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Nome completo <span className="text-red-500">*</span></Label>
            <Input placeholder="Ex: Carlos Pereira" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label>E-mail <span className="text-red-500">*</span></Label>
            <Input type="email" placeholder="carlos@seuzuca.com.br" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Departamento / Equipe</Label>
            <Input placeholder="Ex: Suporte Tier 1" value={form.departamento} onChange={(e) => setForm((f) => ({ ...f, departamento: e.target.value }))} />
          </div>

          <PasswordField
            label="Nova senha"
            placeholder="Deixe em branco para manter a atual"
            value={form.password}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
          />

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={loading} className="flex-1 bg-[#C0181A] hover:bg-[#a01418]">
              {loading ? "Salvando..." : "Salvar alterações"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          </div>

          {/* Delete zone — blocked for owner */}
          {user.email === OWNER_EMAIL ? (
            <div className="border-t pt-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-gray-50 rounded-lg px-3 py-2">
                <ShieldCheck size={13} className="text-[#C0181A] shrink-0" />
                Conta de proprietário — não pode ser excluída
              </div>
            </div>
          ) : (
            <div className="border-t pt-4">
              {!confirmDelete ? (
                <button type="button" onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors">
                  <Trash2 size={14} /> Excluir este usuário
                </button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-semibold text-red-700">Confirmar exclusão?</p>
                  <p className="text-xs text-red-600">Esta ação é irreversível. O usuário <strong>{user.nome}</strong> perderá acesso imediatamente.</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="destructive" disabled={deleting} onClick={handleDelete} className="text-xs">
                      {deleting ? "Excluindo..." : "Sim, excluir"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDelete(false)} className="text-xs">Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose }: { user: UserType; onClose: () => void }) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mustChangePw, setMustChangePw] = useState(true);

  const roleColors: Record<string, string> = {
    buyer: "bg-blue-100 text-blue-700",
    supplier: "bg-emerald-100 text-emerald-700",
    admin: "bg-red-100 text-red-700",
    support: "bg-gray-100 text-gray-700",
  };

  function handleGenerate() {
    setPassword(generatePassword());
    setShow(true);
  }

  function handleCopy() {
    navigator.clipboard.writeText(password).catch(() => {
      const el = document.createElement("textarea");
      el.value = password;
      el.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
      document.body.appendChild(el);
      el.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || password.length < 8) {
      toast({ title: "A senha deve ter pelo menos 8 caracteres", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, mustChangePassword: mustChangePw }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message || "Erro ao redefinir"); }
      setSuccess(true);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md z-10">
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <KeyRound size={15} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Redefinir senha</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-5">
          {success ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <CheckCheck size={16} />
                <span className="text-sm font-medium">Senha redefinida com sucesso!</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Usuário</p>
                <p className="text-sm font-medium">{user.nome}</p>
                <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[user.role || ""] || "bg-gray-100 text-gray-700"}`}>
                  {roleLabel[user.role || ""] || user.role}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Nova senha</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-sm font-mono tracking-wide">{password}</code>
                  <Button type="button" size="sm" variant="outline" onClick={handleCopy} className="h-9 gap-1.5 shrink-0">
                    {copied ? <CheckCheck size={14} className="text-green-600" /> : <Copy size={14} />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
                <p className="text-xs text-amber-600 mt-2">Anote esta senha — não será exibida novamente.</p>
              </div>
              <Button className="w-full bg-[#C0181A] hover:bg-[#a01418]" onClick={onClose}>Fechar</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
                <p className="font-medium text-gray-900">{user.nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
                <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[user.role || ""] || "bg-gray-100 text-gray-700"}`}>
                  {roleLabel[user.role || ""] || user.role}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Nova senha <span className="text-red-500">*</span></Label>
                  <button type="button" onClick={handleGenerate} className="text-xs text-[#E85D00] hover:underline">
                    Gerar senha segura
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={show ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700"
                  >
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={mustChangePw}
                  onChange={(e) => setMustChangePw(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-amber-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">Obrigar troca de senha no primeiro acesso</p>
                  <p className="text-xs text-muted-foreground mt-0.5">O usuário será redirecionado para alterar a senha ao fazer login.</p>
                </div>
              </label>

              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={loading} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white">
                  {loading ? "Salvando..." : "Redefinir senha"}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateInternalUserTab({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ ...EMPTY_INTERNAL });
  const [loading, setLoading] = useState(false);
  const [internalUsers, setInternalUsers] = useState<InternalUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [success, setSuccess] = useState<{ nome: string; email: string; senha: string; role: string } | null>(null);
  const [editingUser, setEditingUser] = useState<InternalUser | null>(null);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const r = await fetch("/api/admin/internal-users", { credentials: "include" });
      if (r.ok) setInternalUsers(await r.json());
    } finally { setLoadingUsers(false); }
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.email || !form.password) {
      toast({ title: "Preencha nome, e-mail e senha", variant: "destructive" }); return;
    }
    if (form.password.length < 8) {
      toast({ title: "Senha deve ter pelo menos 8 caracteres", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/admin/create-internal-user", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message || "Erro ao criar usuário"); }
      setSuccess({ nome: form.nome, email: form.email, senha: form.password, role: form.role });
      setForm({ ...EMPTY_INTERNAL });
      onCreated();
      loadUsers();
      toast({ title: "Usuário criado com sucesso!" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <>
      {editingUser && (
        <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSaved={loadUsers} />
      )}

      <div className="space-y-6">
        {/* Credentials card */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
              <CheckCircle size={16} /> Usuário criado com sucesso
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <div className="bg-white border border-green-100 rounded-lg px-3 py-2">
                <p className="text-xs text-muted-foreground mb-0.5">Nome</p>
                <p className="font-semibold">{success.nome}</p>
              </div>
              <div className="bg-white border border-green-100 rounded-lg px-3 py-2">
                <p className="text-xs text-muted-foreground mb-0.5">E-mail</p>
                <p className="font-mono text-sm">{success.email}</p>
              </div>
              <div className="bg-white border border-green-100 rounded-lg px-3 py-2">
                <p className="text-xs text-muted-foreground mb-0.5">Senha</p>
                <p className="font-mono text-sm">{success.senha}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{ROLE_INTERNAL_LABEL[success.role] || success.role}</Badge>
              <p className="text-xs text-muted-foreground">Repasse essas credenciais ao usuário de forma segura</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSuccess(null)} className="text-xs">Fechar</Button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Create form */}
          <Card className="shadow-none border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck size={17} className="text-[#C0181A]" />
                Criar Usuário Interno
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Papel <span className="text-red-500">*</span></Label>
                  <RoleSelector value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} />
                </div>

                <div className="space-y-1.5">
                  <Label>Nome completo <span className="text-red-500">*</span></Label>
                  <Input placeholder="Ex: Carlos Pereira" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
                </div>

                <div className="space-y-1.5">
                  <Label>E-mail <span className="text-red-500">*</span></Label>
                  <Input type="email" placeholder="carlos@seuzuca.com.br" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>

                <div className="space-y-1.5">
                  <Label>Departamento / Equipe</Label>
                  <Input placeholder="Ex: Suporte Tier 1" value={form.departamento} onChange={(e) => setForm((f) => ({ ...f, departamento: e.target.value }))} />
                </div>

                <PasswordField
                  label="Senha"
                  required
                  value={form.password}
                  onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                />

                <Button type="submit" disabled={loading} className="w-full bg-[#C0181A] hover:bg-[#a01418]">
                  {loading ? "Criando..." : "Criar usuário"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* User list */}
          <Card className="shadow-none border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users size={17} className="text-[#C0181A]" />
                Usuários Internos Ativos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingUsers ? (
                <div className="py-8 text-center text-sm text-muted-foreground px-4">Carregando...</div>
              ) : internalUsers.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground px-4">Nenhum usuário interno cadastrado</div>
              ) : (
                <div className="divide-y">
                  {internalUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-gray-50 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${u.role === "admin" ? "bg-red-100" : "bg-blue-100"}`}>
                        {u.role === "admin"
                          ? <ShieldCheck size={14} className="text-[#C0181A]" />
                          : <Headphones size={14} className="text-blue-600" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        {u.ramo && <p className="text-xs text-muted-foreground">{u.ramo}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock size={10} />
                          {u.ultimoAcesso
                            ? <>Último acesso: {new Date(u.ultimoAcesso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</>
                            : "Nunca acessou"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant={u.role === "admin" ? "destructive" : "secondary"} className="text-xs">
                          {ROLE_INTERNAL_LABEL[u.role] || u.role}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => setEditingUser(u)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                          title="Editar usuário"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

// ─── Componente: Upload de imagem para banner ─────────────────────────────────
function BannerImageUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res) => {
      const servedUrl = `/api/storage${res.objectPath}`;
      onChange(servedUrl);
      toast({ title: "Imagem enviada com sucesso!" });
    },
    onError: (err) => {
      toast({ title: err.message || "Erro ao enviar imagem", variant: "destructive" });
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione um arquivo de imagem", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "A imagem deve ter no máximo 5 MB", variant: "destructive" });
      return;
    }
    await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      {/* Mode selector */}
      <div className="flex rounded-lg border overflow-hidden text-xs font-medium w-fit">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${mode === "upload" ? "bg-[#C0181A] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
        >
          <UploadCloud size={13} /> Upload de arquivo
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors border-l ${mode === "url" ? "bg-[#C0181A] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
        >
          <LinkIcon size={13} /> URL externa
        </button>
      </div>

      {/* Upload area */}
      {mode === "upload" && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-lg border-2 border-dashed border-gray-200 hover:border-[#C0181A]/40 hover:bg-red-50/30 transition-all disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <div className="w-full bg-gray-200 rounded-full h-1.5 max-w-[180px]">
                  <div className="bg-[#C0181A] h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">Enviando... {progress}%</span>
              </>
            ) : (
              <>
                <UploadCloud size={22} className="text-gray-400" />
                <span className="text-xs text-muted-foreground">Clique para selecionar uma imagem<br /><span className="text-gray-400">PNG, JPG, WebP — máx. 5 MB</span></span>
              </>
            )}
          </button>
        </div>
      )}

      {/* URL input */}
      {mode === "url" && (
        <Input
          placeholder="https://exemplo.com/imagem.jpg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {/* Preview */}
      {value && (
        <div className="relative group w-full rounded-lg overflow-hidden border border-gray-100 bg-gray-50" style={{ height: 90 }}>
          <img src={value} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <XIcon size={12} />
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-2 py-1">
            <p className="text-white text-xs truncate">{value.startsWith("/api/") ? "Imagem enviada" : value}</p>
          </div>
        </div>
      )}
      {!value && <p className="text-xs text-muted-foreground">Imagem exibida à direita do banner</p>}
    </div>
  );
}

// ─── Aba: Banners ─────────────────────────────────────────────────────────────
type BannerType = {
  id: number;
  titulo: string;
  subtitulo?: string | null;
  destaque?: string | null;
  tag?: string | null;
  imagemUrl?: string | null;
  linkUrl?: string | null;
  corFundo: string;
  ativo: boolean;
  ordem: number;
};

const COR_OPTIONS = [
  { label: "Vermelho → Laranja (padrão)", value: "from-[#C0181A] to-[#E85D00]" },
  { label: "Azul escuro → Azul", value: "from-[#1a3a6b] to-[#2a5298]" },
  { label: "Verde escuro → Verde", value: "from-[#1a6b2a] to-[#2a8a3a]" },
  { label: "Cinza escuro → Cinza", value: "from-[#1a1a1a] to-[#444444]" },
  { label: "Roxo escuro → Roxo", value: "from-[#3b0764] to-[#7c3aed]" },
  { label: "Laranja escuro → Amarelo", value: "from-[#92400e] to-[#d97706]" },
];

const EMPTY_FORM = {
  titulo: "", subtitulo: "", destaque: "", tag: "",
  imagemUrl: "", linkUrl: "", corFundo: COR_OPTIONS[0].value, ativo: true,
};

function BannersTab() {
  const { toast } = useToast();
  const [banners, setBanners] = useState<BannerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  async function loadBanners() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/banners", { credentials: "include" });
      if (r.ok) setBanners(await r.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadBanners(); }, []);

  function openNew() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function openEdit(b: BannerType) {
    setEditingId(b.id);
    setForm({
      titulo: b.titulo,
      subtitulo: b.subtitulo || "",
      destaque: b.destaque || "",
      tag: b.tag || "",
      imagemUrl: b.imagemUrl || "",
      linkUrl: b.linkUrl || "",
      corFundo: b.corFundo,
      ativo: b.ativo,
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) { toast({ title: "Título é obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/banners/${editingId}` : "/api/admin/banners";
      const method = editingId ? "PUT" : "POST";
      const body = {
        ...form,
        subtitulo: form.subtitulo || null,
        destaque: form.destaque || null,
        tag: form.tag || null,
        imagemUrl: form.imagemUrl || null,
        linkUrl: form.linkUrl || null,
        ordem: editingId
          ? banners.find((b) => b.id === editingId)?.ordem ?? banners.length + 1
          : banners.length + 1,
      };
      const r = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).message || "Erro ao salvar");
      toast({ title: editingId ? "Banner atualizado!" : "Banner criado!" });
      setShowForm(false);
      loadBanners();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: number) {
    try {
      const r = await fetch(`/api/admin/banners/${id}/toggle`, { method: "PATCH", credentials: "include" });
      if (!r.ok) throw new Error();
      loadBanners();
    } catch {
      toast({ title: "Erro ao alterar status", variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Confirmar exclusão do banner?")) return;
    try {
      const r = await fetch(`/api/admin/banners/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error();
      toast({ title: "Banner excluído" });
      loadBanners();
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  }

  function handleDragStart(id: number) {
    setDraggedId(id);
  }

  function handleDragOver(e: React.DragEvent, id: number) {
    e.preventDefault();
    if (id !== draggedId) setDragOverId(id);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverId(null);
  }

  async function handleDrop(targetId: number) {
    if (!draggedId || draggedId === targetId) { handleDragEnd(); return; }
    const from = banners.findIndex((b) => b.id === draggedId);
    const to = banners.findIndex((b) => b.id === targetId);
    if (from === -1 || to === -1) { handleDragEnd(); return; }

    const reordered = [...banners];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setBanners(reordered);
    handleDragEnd();

    setReordering(true);
    try {
      const r = await fetch("/api/admin/banners/reorder", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((b) => b.id) }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Ordem atualizada!" });
      loadBanners();
    } catch {
      toast({ title: "Erro ao reordenar", variant: "destructive" });
      loadBanners();
    } finally {
      setReordering(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{banners.length} {banners.length === 1 ? "banner cadastrado" : "banners cadastrados"}</p>
        <Button onClick={openNew} className="bg-[#C0181A] hover:bg-[#a01418] gap-2 text-sm">
          <Plus size={15} />
          Novo Banner
        </Button>
      </div>

      {/* Formulário */}
      {showForm && (
        <Card className="border-[#E85D00]/30 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#C0181A] flex items-center gap-2">
              <ImageIcon size={18} />
              {editingId ? "Editar Banner" : "Novo Banner"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Titulo principal <span className="text-red-500">*</span></Label>
                  <Input placeholder="Ex: MATERIAIS DE QUALIDADE" value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">Aparece em letras maiúsculas grandes no banner</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Tag / Chamada</Label>
                  <Input placeholder="Ex: Feirão da Construção" value={form.tag} onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">Pílula pequena acima do título</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Destaque (caixa amarela)</Label>
                  <Input placeholder="Ex: até 30% OFF" value={form.destaque} onChange={(e) => setForm((f) => ({ ...f, destaque: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">Texto em destaque amarelo abaixo do título</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Subtítulo</Label>
                  <Input placeholder="Ex: em produtos selecionados" value={form.subtitulo} onChange={(e) => setForm((f) => ({ ...f, subtitulo: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">Texto menor abaixo do destaque</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Imagem do banner</Label>
                  <BannerImageUploader
                    value={form.imagemUrl}
                    onChange={(url) => setForm((f) => ({ ...f, imagemUrl: url }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Link do botão "Ver ofertas"</Label>
                  <Input placeholder="/catalogo ou URL completa" value={form.linkUrl} onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">Deixe vazio para ir ao catálogo</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Cor de fundo</Label>
                <select
                  value={form.corFundo}
                  onChange={(e) => setForm((f) => ({ ...f, corFundo: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D00]"
                >
                  {COR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {/* Preview */}
                <div className={`h-10 rounded-md bg-gradient-to-r ${form.corFundo} flex items-center px-4`}>
                  <span className="text-white text-xs font-semibold opacity-80">Visualização do gradiente</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="ativo" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} className="w-4 h-4 accent-[#C0181A]" />
                <Label htmlFor="ativo" className="cursor-pointer">Banner ativo (visível no site)</Label>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving} className="bg-[#C0181A] hover:bg-[#a01418]">
                  {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar banner"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista de banners */}
      {loading ? (
        <div className="py-10 text-center text-muted-foreground text-sm">Carregando banners...</div>
      ) : banners.length === 0 ? (
        <div className="py-12 text-center">
          <ImageIcon size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-muted-foreground text-sm">Nenhum banner cadastrado.</p>
          <p className="text-xs text-muted-foreground mt-1">Clique em "Novo Banner" para criar o primeiro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reordering && <p className="text-xs text-center text-muted-foreground">Salvando nova ordem...</p>}
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <GripVertical size={12} /> Arraste pelo ícone para reordenar
          </p>
          {banners.map((b, index) => (
            <Card
              key={b.id}
              draggable
              onDragStart={() => handleDragStart(b.id)}
              onDragOver={(e) => handleDragOver(e, b.id)}
              onDrop={() => handleDrop(b.id)}
              onDragEnd={handleDragEnd}
              className={`shadow-none border transition-all ${
                b.ativo ? "border-border" : "border-dashed border-gray-200 opacity-60"
              } ${dragOverId === b.id ? "border-[#C0181A] border-2 scale-[1.01]" : ""} ${
                draggedId === b.id ? "opacity-40" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Drag handle + order */}
                  <div className="flex flex-col items-center gap-1 pt-1 shrink-0 cursor-grab active:cursor-grabbing">
                    <GripVertical size={16} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                  </div>

                  {/* Color preview */}
                  <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${b.corFundo} shrink-0 flex items-center justify-center shadow-inner`}>
                    <ImageIcon size={20} className="text-white/60" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-sm text-gray-900 truncate">{b.titulo}</p>
                      {b.tag && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{b.tag}</span>}
                      <Badge variant={b.ativo ? "default" : "secondary"} className="text-xs">
                        {b.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      {b.destaque && <span>Destaque: <strong className="text-gray-700">{b.destaque}</strong></span>}
                      {b.subtitulo && <span>Sub: {b.subtitulo}</span>}
                      {b.imagemUrl && <span className="flex items-center gap-1"><ExternalLink size={10} />Com imagem</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      title={b.ativo ? "Desativar" : "Ativar"}
                      onClick={() => handleToggle(b.id)}
                    >
                      {b.ativo ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-gray-400" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Editar" onClick={() => openEdit(b)}>
                      <Edit2 size={15} className="text-blue-500" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" title="Excluir" onClick={() => handleDelete(b.id)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Aba: Criar Fornecedor ────────────────────────────────────────────────────
function CreateSupplierTab({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [success, setSuccess] = useState<{ nome: string; email: string; senha: string } | null>(null);
  const [form, setForm] = useState({
    nome: "",
    razaoSocial: "",
    nomeFantasia: "",
    email: "",
    password: "",
    cnpj: "",
    telefone: "",
    ramo: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: "" }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Nome é obrigatório";
    if (!form.email.trim()) e.email = "E-mail é obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "E-mail inválido";
    if (!form.password.trim()) e.password = "Senha é obrigatória";
    else if (form.password.length < 6) e.password = "Mínimo 6 caracteres";
    if (!form.cnpj.trim()) e.cnpj = "CNPJ é obrigatório";
    else if (form.cnpj.replace(/\D/g, "").length !== 14) e.cnpj = "CNPJ deve ter 14 dígitos";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/create-supplier", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cnpj: form.cnpj.replace(/\D/g, ""),
          razaoSocial: form.razaoSocial || form.nome,
          nomeFantasia: form.nomeFantasia || form.nome,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao criar fornecedor");
      }

      setSuccess({ nome: form.nomeFantasia || form.nome, email: form.email, senha: form.password });
      setForm({ nome: "", razaoSocial: "", nomeFantasia: "", email: "", password: "", cnpj: "", telefone: "", ramo: "" });
      onCreated();
      toast({ title: "Fornecedor criado com sucesso!" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar fornecedor";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
          <h3 className="text-lg font-bold text-green-800 mb-1">Fornecedor criado com sucesso!</h3>
          <p className="text-green-700 text-sm mb-4">Envie as credenciais ao fornecedor para que ele possa acessar a plataforma.</p>
          <div className="bg-white border border-green-200 rounded-lg p-4 text-left text-sm space-y-2 mb-5">
            <p><span className="font-semibold text-gray-600">Empresa:</span> <span className="font-bold">{success.nome}</span></p>
            <p><span className="font-semibold text-gray-600">E-mail:</span> <span className="font-mono">{success.email}</span></p>
            <p><span className="font-semibold text-gray-600">Senha:</span> <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{success.senha}</span></p>
          </div>
          <Button onClick={() => setSuccess(null)} className="bg-[#C0181A] hover:bg-[#a01416]">
            Criar outro fornecedor
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-gray-500 mb-6">
        Crie um acesso de fornecedor já aprovado. O fornecedor poderá cadastrar seus produtos imediatamente após o primeiro login.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-gray-50 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Dados da empresa</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Nome do responsável <span className="text-red-500">*</span></Label>
              <Input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: João Silva" className={errors.nome ? "border-red-400" : ""} />
              {errors.nome && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.nome}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Razão Social</Label>
              <Input value={form.razaoSocial} onChange={e => set("razaoSocial", e.target.value)} placeholder="Ex: Empresa LTDA" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nome Fantasia</Label>
              <Input value={form.nomeFantasia} onChange={e => set("nomeFantasia", e.target.value)} placeholder="Como aparecerá na plataforma" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">CNPJ <span className="text-red-500">*</span></Label>
              <Input
                value={form.cnpj}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, "").slice(0, 14);
                  const fmt = raw
                    .replace(/(\d{2})(\d)/, "$1.$2")
                    .replace(/(\d{3})(\d)/, "$1.$2")
                    .replace(/(\d{3})(\d)/, "$1/$2")
                    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
                  set("cnpj", fmt);
                }}
                placeholder="00.000.000/0000-00"
                className={`font-mono ${errors.cnpj ? "border-red-400" : ""}`}
              />
              {errors.cnpj && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.cnpj}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Telefone</Label>
              <Input value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(11) 99999-9999" />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Ramo de atividade</Label>
              <Input value={form.ramo} onChange={e => set("ramo", e.target.value)} placeholder="Ex: Materiais de construção, tintas, etc." />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Credenciais de acesso</h3>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">E-mail <span className="text-red-500">*</span></Label>
            <Input
              type="email"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              placeholder="fornecedor@empresa.com.br"
              className={errors.email ? "border-red-400" : ""}
            />
            {errors.email && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Senha inicial <span className="text-red-500">*</span></Label>
              <button
                type="button"
                onClick={() => set("password", generatePassword())}
                className="flex items-center gap-1 text-xs text-[#C0181A] hover:underline font-medium"
              >
                <RefreshCw size={12} />
                Gerar senha segura
              </button>
            </div>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={e => set("password", e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className={`pr-10 font-mono ${errors.password ? "border-red-400" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors.password}</p>}
            <p className="text-xs text-gray-400">Anote a senha — ela não poderá ser recuperada por aqui depois.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="bg-[#C0181A] hover:bg-[#a01416] flex items-center gap-2">
            <UserPlus size={16} />
            {loading ? "Criando fornecedor..." : "Criar fornecedor"}
          </Button>
          <Button type="button" variant="outline" onClick={() => {
            setForm({ nome: "", razaoSocial: "", nomeFantasia: "", email: "", password: "", cnpj: "", telefone: "", ramo: "" });
            setErrors({});
          }}>
            Limpar
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Aba: Categorias ─────────────────────────────────────────────────────────
type CatType = { id: number; nome: string; slug?: string; icone?: string; descricao?: string; parentId?: number | null; ordem?: number };

const EMPTY_CAT = { nome: "", slug: "", icone: "", descricao: "" };

function CategoriesTab() {
  const { toast } = useToast();
  const { data: rawCategories, refetch } = useListCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const [form, setForm] = useState({ ...EMPTY_CAT });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const categories = (rawCategories as unknown as CatType[]) || [];

  function startEdit(cat: CatType) {
    setEditingId(cat.id);
    setForm({ nome: cat.nome, slug: cat.slug || "", icone: cat.icone || "", descricao: cat.descricao || "" });
  }

  function cancelEdit() { setEditingId(null); setForm({ ...EMPTY_CAT }); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: String(editingId), data: { nome: form.nome, slug: form.slug || form.nome.toLowerCase().replace(/\s+/g, "-"), icone: form.icone || undefined, descricao: form.descricao || undefined } });
        toast({ title: "Categoria atualizada!" });
      } else {
        await createMutation.mutateAsync({ data: { nome: form.nome, slug: form.slug || form.nome.toLowerCase().replace(/\s+/g, "-"), icone: form.icone || undefined, descricao: form.descricao || undefined } });
        toast({ title: "Categoria criada!" });
      }
      setForm({ ...EMPTY_CAT });
      setEditingId(null);
      refetch();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro ao salvar", variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteMutation.mutateAsync({ id: String(id) });
      toast({ title: "Categoria excluída" });
      setConfirmDeleteId(null);
      refetch();
    } catch {
      toast({ title: "Não é possível excluir — há produtos nesta categoria", variant: "destructive" });
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Form */}
      <Card className="shadow-none border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen size={17} className="text-[#C0181A]" />
            {editingId ? "Editar Categoria" : "Nova Categoria"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome <span className="text-red-500">*</span></Label>
              <Input placeholder="Ex: Estrutura" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Slug (URL)</Label>
              <Input placeholder="estrutura" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Ícone (nome Lucide)</Label>
              <Input placeholder="building-2" value={form.icone} onChange={(e) => setForm((f) => ({ ...f, icone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea placeholder="Breve descrição da categoria..." value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-[#C0181A] hover:bg-[#a01418]">
                {editingId ? "Salvar alterações" : "Criar categoria"}
              </Button>
              {editingId && <Button type="button" variant="outline" onClick={cancelEdit}>Cancelar</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="shadow-none border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag size={17} className="text-[#C0181A]" />
            Categorias ({categories.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">Nenhuma categoria cadastrada</p>
          ) : (
            <div className="divide-y">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-gray-50">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                    <FolderOpen size={14} className="text-[#E85D00]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cat.nome}</p>
                    {cat.slug && <p className="text-xs text-muted-foreground font-mono">/{cat.slug}</p>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="p-1.5 h-7 w-7" onClick={() => startEdit(cat)}>
                      <Edit2 size={13} />
                    </Button>
                    {confirmDeleteId === cat.id ? (
                      <div className="flex gap-1 items-center">
                        <Button variant="destructive" size="sm" className="h-6 text-xs px-2" onClick={() => handleDelete(cat.id)}>Confirmar</Button>
                        <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setConfirmDeleteId(null)}>Não</Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="p-1.5 h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDeleteId(cat.id)}>
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Aba: Aprovação de Produtos ───────────────────────────────────────────────
type AdminProductType = {
  id: number; nome: string; sku?: string; preco: number; unidadeMedida: string;
  estoque: number; disponivel: boolean; aprovado: boolean; imagemPrincipal?: string;
  createdAt: string; categoryName?: string; supplierName?: string;
};

function ProductsApprovalTab() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"false" | "true" | "all">("false");
  const [products, setProducts] = useState<AdminProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [commissions, setCommissions] = useState<Record<number, string>>({});
  const [savingCommission, setSavingCommission] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const url = filter === "all" ? "/api/admin/products" : `/api/admin/products?aprovado=${filter}`;
      const r = await fetch(url, { credentials: "include" });
      if (r.ok) { const d = await r.json(); setProducts(d.products || []); setTotal(d.total || 0); }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filter]);

  async function handleSaveCommission(id: number) {
    const val = commissions[id];
    if (val === undefined || val === "") return;
    setSavingCommission(id);
    try {
      const r = await fetch(`/api/admin/products/${id}/commission`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comissao: Number(val) }),
      });
      if (r.ok) toast({ title: "Comissão salva" });
      else toast({ title: "Erro ao salvar comissão", variant: "destructive" });
    } finally { setSavingCommission(null); }
  }

  async function handleApprove(id: number) {
    try {
      await fetch(`/api/admin/products/${id}/approve`, { method: "PUT", credentials: "include" });
      toast({ title: "Produto aprovado!" });
      load();
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }

  async function handleReject(id: number) {
    try {
      await fetch(`/api/admin/products/${id}/reject`, { method: "PUT", credentials: "include" });
      toast({ title: "Produto ocultado" });
      load();
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  }

  const BRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <Card className="shadow-none border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package size={18} className="text-[#C0181A]" />
            Moderação de Produtos
          </CardTitle>
          <div className="flex gap-1">
            {[
              { v: "false", label: "Aguardando" },
              { v: "true",  label: "Aprovados" },
              { v: "all",   label: "Todos" },
            ].map(f => (
              <button
                key={f.v}
                onClick={() => setFilter(f.v as "false" | "true" | "all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filter === f.v ? "bg-[#C0181A] text-white border-[#C0181A]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{total} {total === 1 ? "produto" : "produtos"} encontrado{total !== 1 ? "s" : ""}</p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p>{filter === "false" ? "Nenhum produto aguardando aprovação" : "Nenhum produto encontrado"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Produto</th>
                  <th className="text-left py-3 text-muted-foreground font-medium hidden sm:table-cell">Fornecedor</th>
                  <th className="text-right py-3 text-muted-foreground font-medium">Preço</th>
                  <th className="text-center py-3 text-muted-foreground font-medium hidden md:table-cell">Comissão %</th>
                  <th className="text-center py-3 text-muted-foreground font-medium">Status</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded overflow-hidden shrink-0">
                          {p.imagemPrincipal
                            ? <img src={p.imagemPrincipal} alt="" className="w-full h-full object-cover" />
                            : <Package size={14} className="m-auto text-muted-foreground" />}
                        </div>
                        <div>
                          <p className="font-medium line-clamp-1">{p.nome}</p>
                          <p className="text-xs text-muted-foreground">{p.categoryName} · {new Date(p.createdAt).toLocaleDateString("pt-BR")}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground text-sm hidden sm:table-cell">{p.supplierName || "—"}</td>
                    <td className="py-3 text-right font-semibold">{BRL(p.preco)}</td>
                    <td className="py-3 text-center hidden md:table-cell">
                      <div className="flex items-center gap-1 justify-center">
                        <div className="relative">
                          <Input
                            type="number" min="0" max="100" step="0.01" placeholder="—"
                            value={commissions[p.id] !== undefined ? commissions[p.id] : ""}
                            onChange={e => setCommissions(c => ({ ...c, [p.id]: e.target.value }))}
                            className="w-16 h-6 text-xs pr-5 py-0"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                        </div>
                        <Button
                          size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                          disabled={savingCommission === p.id || !commissions[p.id]}
                          onClick={() => handleSaveCommission(p.id)}
                        >
                          <CheckCircle size={12} />
                        </Button>
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant={p.aprovado ? "default" : "secondary"} className="text-xs">
                        {p.aprovado ? "Aprovado" : "Aguardando"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {!p.aprovado && (
                          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(p.id)}>
                            <CheckCircle size={11} className="mr-1" /> Aprovar
                          </Button>
                        )}
                        {p.aprovado && (
                          <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleReject(p.id)}>
                            Ocultar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Aba: Pedidos Mínimos ─────────────────────────────────────────────────────
type MinRule = { id: number; categoryId: number; categoryName?: string; quantidadeMinima: number; multiplo: number; ativo: boolean };

function MinimumRulesTab() {
  const { toast } = useToast();
  const { data: rawCategories } = useListCategories();
  const categories = (rawCategories as unknown as CatType[]) || [];
  const [rules, setRules] = useState<MinRule[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ categoryId: "", quantidadeMinima: "", multiplo: "1" });
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  async function load() {
    const r = await fetch("/api/admin/category-rules", { credentials: "include" });
    if (r.ok) setRules(await r.json());
  }

  useEffect(() => { load(); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.categoryId || !form.quantidadeMinima) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" }); return;
    }
    const body = { categoryId: Number(form.categoryId), quantidadeMinima: Number(form.quantidadeMinima), multiplo: Number(form.multiplo) || 1, ativo: true };
    const url = editingId ? `/api/admin/category-rules/${editingId}` : "/api/admin/category-rules";
    const r = await fetch(url, { method: editingId ? "PUT" : "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) {
      toast({ title: editingId ? "Regra atualizada" : "Regra criada" });
      setEditingId(null);
      setForm({ categoryId: "", quantidadeMinima: "", multiplo: "1" });
      load();
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/admin/category-rules/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "Regra excluída" });
    setConfirmDel(null);
    load();
  }

  function startEdit(rule: MinRule) {
    setEditingId(rule.id);
    setForm({ categoryId: String(rule.categoryId), quantidadeMinima: String(rule.quantidadeMinima), multiplo: String(rule.multiplo) });
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="shadow-none border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{editingId ? "Editar Regra" : "Nova Regra de Mínimo"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Categoria <span className="text-red-500">*</span></Label>
              <select
                className="w-full border border-input bg-background rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.categoryId}
                onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
              >
                <option value="">Selecione...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Qtd. mínima <span className="text-red-500">*</span></Label>
                <Input type="number" min="1" placeholder="10" value={form.quantidadeMinima} onChange={e => setForm(f => ({ ...f, quantidadeMinima: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Múltiplo</Label>
                <Input type="number" min="1" placeholder="1" value={form.multiplo} onChange={e => setForm(f => ({ ...f, multiplo: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="bg-[#C0181A] hover:bg-[#a01418]">{editingId ? "Salvar" : "Criar regra"}</Button>
              {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm({ categoryId: "", quantidadeMinima: "", multiplo: "1" }); }}>Cancelar</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-none border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Regras cadastradas ({rules.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">Nenhuma regra cadastrada</p>
          ) : (
            <div className="divide-y">
              {rules.map(rule => (
                <div key={rule.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{rule.categoryName || "Categoria"}</p>
                    <p className="text-xs text-muted-foreground">Mín: {rule.quantidadeMinima} · Múltiplo: {rule.multiplo}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="p-1.5 h-7 w-7" onClick={() => startEdit(rule)}><Edit2 size={13} /></Button>
                    {confirmDel === rule.id ? (
                      <div className="flex gap-1 items-center">
                        <Button variant="destructive" size="sm" className="h-6 text-xs px-2" onClick={() => handleDelete(rule.id)}>Confirmar</Button>
                        <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setConfirmDel(null)}>Não</Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="p-1.5 h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDel(rule.id)}><Trash2 size={13} /></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Aba: Moderação de Avaliações ─────────────────────────────────────────────
type ReviewAdmin = {
  id: number; nota: number; comentario: string; aprovada: boolean;
  createdAt: string; buyerName?: string; productName?: string; productImage?: string;
};

function ReviewsModerationTab() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<ReviewAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("pending");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/reviews", { credentials: "include" });
      if (r.ok) setReviews(await r.json());
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(id: number) {
    await fetch(`/api/admin/reviews/${id}/approve`, { method: "PUT", credentials: "include" });
    toast({ title: "Avaliação aprovada" });
    load();
  }

  async function handleReject(id: number) {
    await fetch(`/api/admin/reviews/${id}/reject`, { method: "PUT", credentials: "include" });
    toast({ title: "Avaliação ocultada" });
    load();
  }

  const filtered = reviews.filter(r =>
    filter === "all" ? true : filter === "pending" ? !r.aprovada : r.aprovada
  );

  return (
    <Card className="shadow-none border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Star size={17} className="text-[#C0181A]" />
            Moderação de Avaliações
          </CardTitle>
          <div className="flex gap-1">
            {[{ v: "pending", l: "Aguardando" }, { v: "approved", l: "Aprovadas" }, { v: "all", l: "Todas" }].map(f => (
              <button key={f.v} onClick={() => setFilter(f.v as "all" | "pending" | "approved")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filter === f.v ? "bg-[#C0181A] text-white border-[#C0181A]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>
                {f.l}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{filtered.length} avaliação{filtered.length !== 1 ? "ões" : ""}</p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Star size={36} className="mx-auto mb-3 opacity-30" />
            <p>{filter === "pending" ? "Nenhuma avaliação aguardando" : "Nenhuma avaliação encontrada"}</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map(review => (
              <div key={review.id} className="px-4 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded bg-muted overflow-hidden shrink-0">
                      {review.productImage
                        ? <img src={review.productImage} alt="" className="w-full h-full object-cover" />
                        : <Package size={14} className="m-auto text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{review.buyerName || "Comprador"}</span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={11} className={i < review.nota ? "fill-amber-400 text-amber-400" : "text-gray-200"} />
                          ))}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${review.aprovada ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {review.aprovada ? "Aprovada" : "Aguardando"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{review.productName} · {new Date(review.createdAt).toLocaleDateString("pt-BR")}</p>
                      <p className="text-sm mt-1 line-clamp-2">{review.comentario}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!review.aprovada && (
                      <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(review.id)}>
                        <CheckCircle size={11} className="mr-1" /> Aprovar
                      </Button>
                    )}
                    {review.aprovada && (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleReject(review.id)}>
                        Ocultar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Aba: Analytics ──────────────────────────────────────────────────────────
const PERIODS = [
  { label: "7 dias", value: "7d" },
  { label: "30 dias", value: "30d" },
  { label: "3 meses", value: "3m" },
  { label: "6 meses", value: "6m" },
] as const;

const PLACEHOLDER_MONTHS = ["Nov", "Dez", "Jan", "Fev", "Mar", "Abr"];
const CHART_DATA = PLACEHOLDER_MONTHS.map((m) => ({ mes: m, gmv: 0, comissoes: 0 }));

const BRL_K = (v: number) =>
  v >= 1000
    ? `R$ ${(v / 1000).toFixed(0)}k`
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

function MetricCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <Card className={`border shadow-none ${highlight ? "border-[#C0181A]/30 bg-[#C0181A]/5" : "border-border"}`}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-black leading-tight ${highlight ? "text-[#C0181A]" : "text-gray-900"}`}>{value}</p>
        {sub !== undefined && (
          <p className="text-xs text-muted-foreground mt-1">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

const ALERTS = [
  { priority: "red",    label: "Fornecedores com avaliação abaixo de 3,5" },
  { priority: "red",    label: "Pedidos em disputa sem movimentação" },
  { priority: "red",    label: "Fornecedores com comissão retida / pagamento em atraso" },
  { priority: "yellow", label: "Taxa de cancelamento acima da meta" },
  { priority: "yellow", label: "Fornecedores inativos há 30+ dias" },
  { priority: "green",  label: "Próximo repasse de comissões agendado" },
] as const;

const ALERT_DOT: Record<string, string> = {
  red: "bg-red-500",
  yellow: "bg-amber-400",
  green: "bg-green-500",
};

function AnalyticsTab() {
  const [period, setPeriod] = useState<"7d" | "30d" | "3m" | "6m">("30d");

  return (
    <div className="space-y-6">
      {/* Header + period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Analytics da Plataforma</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Visão estratégica de saúde financeira, comportamento e qualidade.</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                period === p.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Seção 1: Saúde financeira ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="GMV (volume total)" value="--" sub="vs período anterior: --" highlight />
        <MetricCard label="Receita de comissões" value="--" sub="vs período anterior: --" />
        <MetricCard label="Comissão média (%)" value="--" sub="vs período anterior: --" />
        <MetricCard label="Total de pedidos" value="--" sub="vs período anterior: --" />
        <MetricCard label="Ticket médio geral" value="--" sub="vs período anterior: --" />
      </div>

      {/* ── Seção 2: Gráfico de evolução financeira ────────────────── */}
      <Card className="border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">Evolução financeira da plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={CHART_DATA} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#888" }} />
              <YAxis tickFormatter={BRL_K} tick={{ fontSize: 11, fill: "#888" }} width={60} />
              <Tooltip
                formatter={(v: number, name: string) =>
                  [new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v), name]
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="gmv" name="Volume total (GMV)" stroke="#C0181A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="comissoes" name="Receita de comissões" stroke="#E85D00" strokeWidth={2} dot={false} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-center text-muted-foreground mt-2">Dados serão exibidos conforme pedidos forem realizados na plataforma.</p>
        </CardContent>
      </Card>

      {/* ── Seção 3: Top fornecedores + Alertas ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top fornecedores */}
        <Card className="border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Top fornecedores por receita</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum dado disponível</p>
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card className="border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Alertas que exigem ação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ALERTS.map((a, i) => (
              <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${ALERT_DOT[a.priority]}`} />
                <span className="text-sm text-gray-700">{a.label}</span>
                <span className="ml-auto text-xs font-semibold text-muted-foreground">--</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Seção 4: Qualidade + Categorias por volume ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Qualidade */}
        <Card className="border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Qualidade geral da plataforma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              "Avaliação média dos fornecedores",
              "Taxa de devolução geral",
              "Taxa de cancelamento geral",
              "Tempo médio de entrega",
              "NPS estimado da plataforma",
              "Reclamações abertas",
            ].map((label) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{label}</span>
                <span className="font-semibold text-gray-800">--</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Categorias por volume */}
        <Card className="border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Categorias por volume de vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum dado disponível</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Seção 5: Compradores + Comissões e repasses ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Comportamento compradores */}
        <Card className="border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Comportamento dos compradores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              "Taxa de recompra (90 dias)",
              "LTV médio por comprador",
              "Compradores com apenas 1 pedido",
              "Regiões que mais compram",
              "Canal de origem predominante",
            ].map((label) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{label}</span>
                <span className="font-semibold text-gray-800">--</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Comissões e repasses */}
        <Card className="border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Comissões e repasses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              { label: "Comissão acumulada no período", red: false },
              { label: "Comissão retida (disputas em aberto)", red: true },
              { label: "Próximo repasse aos fornecedores", red: false },
              { label: "Fornecedor com maior comissão gerada", red: false },
              { label: "Projeção de comissão para o mês", red: false },
            ].map(({ label, red }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className={red ? "text-red-600 font-medium" : "text-gray-600"}>{label}</span>
                <span className={`font-semibold ${red ? "text-red-600" : "text-gray-800"}`}>--</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Seção 6: Ecossistema ────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Ecossistema da plataforma</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Fornecedores ativos" },
            { label: "Compradores ativos" },
            { label: "Novos compradores no período" },
            { label: "Categorias ativas" },
            { label: "Produtos publicados" },
          ].map(({ label }) => (
            <Card key={label} className="border shadow-none bg-gray-50">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-black text-gray-900">--</p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard principal ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "create-supplier" | "internal-users" | "banners" | "categories" | "products" | "minimums" | "reviews" | "relatorios" | "analytics">("overview");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userCommissions, setUserCommissions] = useState<Record<number, string>>({});
  const [savingUserCommission, setSavingUserCommission] = useState<number | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserType | null>(null);
  const [docsViewUser, setDocsViewUser] = useState<UserType | null>(null);

  async function handleSaveUserCommission(userId: number) {
    const val = userCommissions[userId];
    if (val === undefined || val === "") return;
    setSavingUserCommission(userId);
    try {
      const r = await fetch(`/api/admin/users/${userId}/commission`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comissao: Number(val) }),
      });
      if (r.ok) toast({ title: "Comissão do fornecedor salva" });
      else toast({ title: "Erro ao salvar comissão", variant: "destructive" });
    } finally { setSavingUserCommission(null); }
  }

  const { data: dashboard } = useGetDashboardStats({ query: { enabled: isAdmin } });
  const { data: users, isLoading, refetch } = useAdminListUsers({ query: { enabled: isAdmin } });
  const approveMutation = useAdminApproveUser();
  const suspendMutation = useAdminSuspendUser();

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Acesso restrito a administradores</p>
        </div>
      </Layout>
    );
  }

  async function handleApprove(userId: number) {
    await approveMutation.mutateAsync({ id: String(userId) });
    refetch();
    toast({ title: "Usuário aprovado com sucesso" });
  }

  async function handleSuspend(userId: number) {
    await suspendMutation.mutateAsync({ id: String(userId) });
    refetch();
    toast({ title: "Usuário suspenso" });
  }

  const usersData = users as { users?: UserType[] } | UserType[] | undefined;
  const allUsers: UserType[] = Array.isArray(usersData)
    ? usersData
    : (usersData as { users?: UserType[] })?.users || [];

  const filteredUsers = allUsers.filter((u) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "supplier") return u.role === "supplier";
    if (statusFilter === "buyer") return u.role === "buyer";
    return u.status === statusFilter;
  });

  const pendingCount = allUsers.filter((u) => u.status === "pending").length;

  const dash = dashboard as {
    gmvTotal?: number;
    totalPedidos?: number;
    ticketMedio?: number;
    fornecedoresAtivos?: number;
    compradoresAprovados?: number;
    pedidosPendentes?: number;
    comissoesTotais?: number;
    cotacoesPendentes?: number;
  } | undefined;

  const stats = [
    {
      icon: Users,
      label: "Compradores aprovados",
      value: dash?.compradoresAprovados ?? allUsers.filter(u => u.role === "buyer" && u.status === "approved").length,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      icon: Package,
      label: "Fornecedores ativos",
      value: dash?.fornecedoresAtivos ?? allUsers.filter(u => u.role === "supplier" && u.status === "approved").length,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      icon: ShoppingBag,
      label: "Total de pedidos",
      value: dash?.totalPedidos ?? 0,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      icon: TrendingUp,
      label: "GMV Total",
      value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(dash?.gmvTotal ?? 0),
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  const navTabs = [
    { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
    {
      id: "users",
      label: "Usuários",
      icon: Users,
      badge: pendingCount > 0 ? pendingCount : null,
    },
    { id: "create-supplier", label: "Criar Fornecedor", icon: UserPlus },
    { id: "internal-users", label: "Usuários Internos", icon: ShieldCheck },
    { id: "categories", label: "Categorias", icon: FolderOpen },
    { id: "products", label: "Produtos", icon: Package },
    { id: "banners", label: "Banners", icon: ImageIcon },
    { id: "minimums", label: "Qtd. Mínimas", icon: ListOrdered },
    { id: "reviews", label: "Avaliações", icon: Star },
    { id: "relatorios", label: "Relatórios", icon: BarChart2 },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
  ] as const;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
            {pendingCount > 0 && (
              <p className="text-sm text-amber-600 mt-0.5 flex items-center gap-1">
                <Clock size={13} />
                {pendingCount} {pendingCount === 1 ? "usuário aguardando" : "usuários aguardando"} aprovação
              </p>
            )}
          </div>
        </div>

        {/* Nav tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-full overflow-x-auto flex-wrap">
          {navTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
              {"badge" in tab && tab.badge && (
                <span className="bg-[#C0181A] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Aba: Visão Geral ─────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat) => (
                <Card key={stat.label} className="border-border shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center shrink-0`}>
                        <stat.icon size={18} className={stat.color} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground leading-tight">{stat.label}</p>
                        <p className="text-xl font-bold">{stat.value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Extra info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-medium">Pedidos pendentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-black text-amber-500">{dash?.pedidosPendentes ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-medium">Comissões geradas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-black text-emerald-500">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(dash?.comissoesTotais ?? 0)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick actions */}
            {pendingCount > 0 && (
              <Card className="border-amber-200 bg-amber-50 shadow-none">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock size={20} className="text-amber-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-800 text-sm">
                        {pendingCount} {pendingCount === 1 ? "comprador aguarda" : "compradores aguardam"} aprovação
                      </p>
                      <p className="text-xs text-amber-700">Acesse a aba Usuários para aprovar ou recusar</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => { setActiveTab("users"); setStatusFilter("pending"); }}
                    className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                  >
                    Ver pendentes
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Aba: Usuários ────────────────────────────────────────────────── */}
        {activeTab === "users" && (
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Gerenciamento de Usuários</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => { setActiveTab("create-supplier"); }}
                >
                  <UserPlus size={13} />
                  Novo fornecedor
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filter tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { v: "all", label: "Todos" },
                  { v: "pending", label: "Pendentes", highlight: pendingCount > 0 },
                  { v: "approved", label: "Aprovados" },
                  { v: "supplier", label: "Fornecedores" },
                  { v: "buyer", label: "Compradores" },
                  { v: "suspended", label: "Suspensos" },
                ].map(f => (
                  <button
                    key={f.v}
                    onClick={() => setStatusFilter(f.v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      statusFilter === f.v
                        ? "bg-[#C0181A] text-white border-[#C0181A]"
                        : f.highlight
                        ? "bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {f.label}
                    {f.highlight && pendingCount > 0 && (
                      <span className="ml-1.5 bg-amber-500 text-white text-[10px] rounded-full px-1.5">{pendingCount}</span>
                    )}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : filteredUsers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 text-muted-foreground font-medium">Empresa</th>
                        <th className="text-left py-3 text-muted-foreground font-medium">CNPJ</th>
                        <th className="text-left py-3 text-muted-foreground font-medium">Tipo</th>
                        <th className="text-left py-3 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-3 text-muted-foreground font-medium">Cadastro</th>
                        <th className="text-right py-3 text-muted-foreground font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="py-3">
                            <p className="font-medium">{user.nomeFantasia || user.razaoSocial || user.nome}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </td>
                          <td className="py-3">
                            <span className="font-mono text-xs">{user.cnpj ? formatCnpj(user.cnpj) : "-"}</span>
                          </td>
                          <td className="py-3">
                            <Badge
                              variant="outline"
                              className={`text-xs ${user.role === "supplier" ? "border-emerald-300 text-emerald-700" : user.role === "buyer" ? "border-blue-300 text-blue-700" : ""}`}
                            >
                              {roleLabel[user.role || ""] || user.role}
                            </Badge>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1.5">
                              {user.status === "pending" && <Clock size={12} className="text-amber-500" />}
                              {user.status === "approved" && <CheckCircle size={12} className="text-green-500" />}
                              {user.status === "rejected" && <XCircle size={12} className="text-destructive" />}
                              <Badge variant={statusVariant[user.status!] || "secondary"} className="text-xs">
                                {statusLabel[user.status!] || user.status}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-3 text-muted-foreground text-xs">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString("pt-BR") : "-"}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center gap-2 justify-end flex-wrap">
                              {user.email === OWNER_EMAIL ? (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <ShieldCheck size={12} className="text-[#C0181A]" />
                                  Proprietário
                                </span>
                              ) : (
                                <>
                                  {user.role === "supplier" && (
                                    <div className="flex items-center gap-1">
                                      <div className="relative">
                                        <Input
                                          type="number" min="0" max="100" step="0.01" placeholder="Comis.%"
                                          value={userCommissions[user.id!] !== undefined ? userCommissions[user.id!] : ""}
                                          onChange={e => setUserCommissions(c => ({ ...c, [user.id!]: e.target.value }))}
                                          className="w-20 h-6 text-xs pr-5 py-0"
                                        />
                                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                                      </div>
                                      <Button
                                        size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                                        disabled={savingUserCommission === user.id || !userCommissions[user.id!]}
                                        onClick={() => handleSaveUserCommission(user.id!)}
                                        title="Salvar comissão"
                                      >
                                        <CheckCircle size={12} />
                                      </Button>
                                    </div>
                                  )}
                                  {user.status === "pending" && (
                                    <>
                                      <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700" onClick={() => handleApprove(user.id!)}>
                                        <CheckCircle size={11} />
                                        Aprovar
                                      </Button>
                                      <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleSuspend(user.id!)}>
                                        Recusar
                                      </Button>
                                    </>
                                  )}
                                  {user.status === "approved" && user.role !== "admin" && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSuspend(user.id!)}>
                                      Suspender
                                    </Button>
                                  )}
                                  {user.status === "suspended" && (
                                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(user.id!)}>
                                      Reativar
                                    </Button>
                                  )}
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                                    onClick={() => setResetPasswordUser(user)}
                                    title="Redefinir senha"
                                  >
                                    <KeyRound size={11} />
                                    Senha
                                  </Button>
                                  {(user.documentos?.length ?? 0) > 0 && (
                                    <Button
                                      size="sm" variant="outline"
                                      className="h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                                      onClick={() => setDocsViewUser(user)}
                                      title="Ver documentos enviados"
                                    >
                                      <FileText size={11} />
                                      {user.documentos!.length} doc{user.documentos!.length !== 1 ? "s" : ""}
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Nenhum usuário neste filtro</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Aba: Criar Fornecedor ────────────────────────────────────────── */}
        {activeTab === "create-supplier" && (
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <UserPlus size={20} className="text-[#C0181A]" />
                <CardTitle className="text-lg">Criar Acesso de Fornecedor</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CreateSupplierTab onCreated={() => refetch()} />
            </CardContent>
          </Card>
        )}

        {/* ── Aba: Usuários Internos ───────────────────────────────────────── */}
        {activeTab === "internal-users" && (
          <Card className="shadow-none border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-[#C0181A]" />
                <CardTitle className="text-lg">Usuários Internos — Admin e Suporte</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Crie acessos para administradores adicionais e agentes de suporte. Suporte pode visualizar toda a base de fornecedores sem alterar configuracoes do sistema.
              </p>
            </CardHeader>
            <CardContent>
              <CreateInternalUserTab onCreated={() => {}} />
            </CardContent>
          </Card>
        )}

        {/* ── Aba: Banners ─────────────────────────────────────────────────── */}
        {activeTab === "banners" && (
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon size={20} className="text-[#C0181A]" />
                <CardTitle className="text-lg">Gerenciar Banners da Home</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Os banners ativos são exibidos em carrossel na pagina inicial do site. A ordem determina a sequencia de exibicao.
              </p>
            </CardHeader>
            <CardContent>
              <BannersTab />
            </CardContent>
          </Card>
        )}

        {activeTab === "categories" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Gerenciar Categorias</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Crie e edite as categorias de produtos do marketplace.</p>
            </div>
            <CategoriesTab />
          </div>
        )}

        {activeTab === "products" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Aprovação de Produtos</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Revise e aprove produtos enviados pelos fornecedores antes de ficarem visíveis no catálogo.</p>
            </div>
            <ProductsApprovalTab />
          </div>
        )}

        {activeTab === "minimums" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Quantidades Mínimas por Categoria</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Defina pedido mínimo e múltiplos por categoria para compradores B2B.</p>
            </div>
            <MinimumRulesTab />
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Moderação de Avaliações</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Aprove ou oculte avaliações feitas pelos compradores nos produtos.</p>
            </div>
            <ReviewsModerationTab />
          </div>
        )}

        {/* ── Aba: Analytics ──────────────────────────────────────────────────── */}
        {activeTab === "analytics" && <AnalyticsTab />}

        {activeTab === "relatorios" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold">Relatórios</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Relatórios alinhados com os indicadores de Analytics — filtre por período e exporte em PDF, Excel ou CSV.</p>
            </div>

            {/* ── 1. Saúde Financeira (GMV, Comissão, Ticket Médio) ─────── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Saúde Financeira</h3>
              <ReportTab
                title="Pedidos — GMV, Comissão e Ticket Médio"
                endpoint="admin/report/orders"
                filenamePrefix="admin_pedidos"
                columns={[
                  { key: "id", label: "ID", format: (v) => `#${String(v).padStart(6,"0")}` },
                  { key: "data", label: "Data" },
                  { key: "comprador", label: "Comprador" },
                  { key: "fornecedor", label: "Fornecedor" },
                  { key: "total", label: "Total", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), align: "right" },
                  { key: "comissao", label: "Comissão", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), align: "right" },
                  { key: "status", label: "Status" },
                ]}
                summaryItems={[
                  { key: "total", label: "Total de pedidos", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
                  { key: "gmv", label: "GMV", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), color: "text-[#C0181A]", bgColor: "bg-red-50 border-red-200" },
                  { key: "comissoes", label: "Comissões", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200" },
                  { key: "ticketMedio", label: "Ticket médio", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
                ]}
              />
            </div>

            {/* ── 2. Comissões e Repasses ──────────────────────────────── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Comissões e Repasses</h3>
              <ReportTab
                title="Comissões por Pedido"
                endpoint="admin/report/comissoes"
                filenamePrefix="admin_comissoes"
                columns={[
                  { key: "pedido", label: "Pedido", format: (v) => `#${String(v).padStart(6,"0")}` },
                  { key: "data", label: "Data" },
                  { key: "fornecedor", label: "Fornecedor" },
                  { key: "valor_pedido", label: "Valor Pedido", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), align: "right" },
                  { key: "comissao_plataforma", label: "Comissão (R$)", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), align: "right" },
                  { key: "pct_comissao", label: "Comissão (%)", format: (v) => `${Number(v).toFixed(2)}%`, align: "right" },
                  { key: "status", label: "Status" },
                ]}
                summaryItems={[
                  { key: "total", label: "Pedidos com comissão", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
                  { key: "totalComissoes", label: "Total comissões", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), color: "text-[#C0181A]", bgColor: "bg-red-50 border-red-200" },
                  { key: "gmv", label: "GMV período", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
                  { key: "pctMedio", label: "Comissão média (%)", format: (v) => `${Number(v).toFixed(2)}%`, color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200" },
                ]}
              />
            </div>

            {/* ── 3. Top Fornecedores ──────────────────────────────────── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Top Fornecedores</h3>
              <ReportTab
                title="Fornecedores — Volume, Comissão e Avaliação"
                endpoint="admin/report/fornecedores"
                filenamePrefix="admin_fornecedores"
                columns={[
                  { key: "fornecedor", label: "Fornecedor" },
                  { key: "cnpj", label: "CNPJ" },
                  { key: "total_pedidos", label: "Pedidos", align: "right" },
                  { key: "gmv", label: "GMV", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), align: "right" },
                  { key: "comissoes_geradas", label: "Comissão gerada", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), align: "right" },
                  { key: "repasse_liquido", label: "Repasse líquido", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), align: "right" },
                  { key: "avaliacao_media", label: "Avaliação", format: (v) => v != null ? `${Number(v).toFixed(1)} ★` : "—", align: "center" },
                  { key: "compradores_unicos", label: "Compradores únicos", align: "right" },
                  { key: "cancelados", label: "Cancelados", align: "right" },
                ]}
                summaryItems={[
                  { key: "total", label: "Fornecedores ativos", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
                  { key: "totalGmv", label: "GMV total", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), color: "text-[#C0181A]", bgColor: "bg-red-50 border-red-200" },
                  { key: "totalComissoes", label: "Comissões totais", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200" },
                ]}
              />
            </div>

            {/* ── 4. Qualidade da Plataforma ───────────────────────────── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Qualidade da Plataforma</h3>
              <ReportTab
                title="Qualidade por Fornecedor — Cancelamentos e Avaliações"
                endpoint="admin/report/qualidade"
                filenamePrefix="admin_qualidade"
                columns={[
                  { key: "fornecedor", label: "Fornecedor" },
                  { key: "total_pedidos", label: "Pedidos", align: "right" },
                  { key: "cancelados", label: "Cancelados", align: "right" },
                  { key: "taxa_cancelamento", label: "Taxa Cancelamento", format: (v) => `${Number(v).toFixed(1)}%`, align: "right" },
                  { key: "total_avaliacoes", label: "Avaliações", align: "right" },
                  { key: "avaliacao_media", label: "Avaliação Média", format: (v) => v != null ? `${Number(v).toFixed(1)} ★` : "—", align: "center" },
                  { key: "pior_nota", label: "Pior Nota", align: "center" },
                  { key: "melhor_nota", label: "Melhor Nota", align: "center" },
                ]}
                summaryItems={[
                  { key: "total", label: "Fornecedores", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
                  { key: "avgRating", label: "Avaliação média geral", format: (v) => v != null ? `${Number(v).toFixed(1)} ★` : "—", color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200" },
                ]}
              />
            </div>

            {/* ── 5. Categorias por Volume ─────────────────────────────── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Categorias por Volume</h3>
              <ReportTab
                title="Volume de Vendas por Categoria"
                endpoint="admin/report/categorias"
                filenamePrefix="admin_categorias"
                columns={[
                  { key: "categoria", label: "Categoria" },
                  { key: "total_pedidos", label: "Pedidos", align: "right" },
                  { key: "unidades_vendidas", label: "Unidades", align: "right" },
                  { key: "volume_vendas", label: "Volume (R$)", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), align: "right" },
                  { key: "produtos_vendidos", label: "Produtos Únicos", align: "right" },
                ]}
                summaryItems={[
                  { key: "total", label: "Categorias", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
                  { key: "totalVolume", label: "Volume total", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), color: "text-[#C0181A]", bgColor: "bg-red-50 border-red-200" },
                  { key: "totalUnidades", label: "Total unidades", color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
                ]}
              />
            </div>

            {/* ── 6. Comportamento dos Compradores ────────────────────── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Compradores</h3>
              <ReportTab
                title="Comportamento dos Compradores — Recompra e LTV"
                endpoint="admin/report/compradores"
                filenamePrefix="admin_compradores"
                columns={[
                  { key: "comprador", label: "Comprador" },
                  { key: "cnpj", label: "CNPJ" },
                  { key: "total_pedidos", label: "Pedidos", align: "right" },
                  { key: "valor_total", label: "Valor total", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), align: "right" },
                  { key: "ticket_medio", label: "Ticket médio", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), align: "right" },
                  { key: "fornecedores_diferentes", label: "Fornecedores", align: "right" },
                  { key: "ultima_compra", label: "Última compra" },
                ]}
                summaryItems={[
                  { key: "total", label: "Compradores ativos", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
                  { key: "totalCompras", label: "Volume total", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), color: "text-[#C0181A]", bgColor: "bg-red-50 border-red-200" },
                  { key: "ticketMedio", label: "Ticket médio geral", format: (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)), color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200" },
                  { key: "totalPedidos", label: "Total de pedidos", color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200" },
                ]}
              />
            </div>

            {/* ── 7. Ecossistema — Usuários cadastrados ────────────────── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Ecossistema — Novos Cadastros</h3>
              <ReportTab
                title="Usuários Cadastrados no Período"
                endpoint="admin/report/users"
                filenamePrefix="admin_usuarios"
                columns={[
                  { key: "id", label: "ID" },
                  { key: "data_cadastro", label: "Cadastro" },
                  { key: "nome", label: "Nome" },
                  { key: "email", label: "E-mail" },
                  { key: "tipo", label: "Tipo" },
                  { key: "status", label: "Status" },
                  { key: "cnpj", label: "CNPJ" },
                  { key: "nome_fantasia", label: "Nome Fantasia" },
                ]}
                summaryItems={[
                  { key: "total", label: "Novos cadastros", color: "text-violet-600", bgColor: "bg-violet-50 border-violet-200" },
                ]}
              />
            </div>
          </div>
        )}

      </div>

      {resetPasswordUser && (
        <ResetPasswordModal user={resetPasswordUser} onClose={() => setResetPasswordUser(null)} />
      )}

      {/* Modal de documentos do usuário */}
      {docsViewUser && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setDocsViewUser(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">Documentos enviados</h2>
                <p className="text-xs text-gray-500 mt-0.5">{docsViewUser.nomeFantasia || docsViewUser.razaoSocial || docsViewUser.nome}</p>
              </div>
              <button onClick={() => setDocsViewUser(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XIcon size={18} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {(docsViewUser.documentos?.length ?? 0) === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">Nenhum documento enviado</p>
              ) : (
                docsViewUser.documentos!.map((doc, i) => (
                  <a
                    key={i}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-[#C0181A]/30 hover:bg-red-50/30 transition-all group"
                  >
                    <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                      <FileText size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.nome}</p>
                      <p className="text-xs text-gray-400 truncate">{doc.nomeArquivo || doc.url.split("/").pop()}</p>
                    </div>
                    <ExternalLink size={14} className="text-gray-300 group-hover:text-[#C0181A] shrink-0 transition-colors" />
                  </a>
                ))
              )}
            </div>
            <div className="px-6 pb-4">
              <p className="text-xs text-center text-muted-foreground">Clique em um documento para abrir em nova aba</p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
