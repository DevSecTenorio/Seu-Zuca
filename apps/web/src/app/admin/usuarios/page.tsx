import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/require-user";
import { getSignedDocumentUrl } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCnpj } from "@/lib/cnpj";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { approveUserAction, suspendUserAction, reactivateUserAction } from "@/server/actions/user-management-actions";
import { RejectUserDialog } from "./reject-user-dialog";
import { ResetPasswordButton } from "./reset-password-button";
import { KycDocumentsDialog } from "./kyc-documents-dialog";

export const metadata: Metadata = { title: "Usuários — Admin — Seu Zuca" };

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  suspenso: "Suspenso",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "outline",
  aprovado: "default",
  rejeitado: "destructive",
  suspenso: "secondary",
};

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "pendentes", label: "Pendentes" },
  { key: "aprovados", label: "Aprovados" },
  { key: "fornecedores", label: "Fornecedores" },
  { key: "compradores", label: "Compradores" },
  { key: "suspensos", label: "Suspensos" },
];

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  await requireUser(["admin"]);
  const { filtro } = await searchParams;
  const activeFilter = FILTERS.find((f) => f.key === filtro) ?? FILTERS[0];

  const conditions = [inArray(schema.users.role, ["comprador", "fornecedor"])];
  if (activeFilter.key === "pendentes") conditions.push(eq(schema.users.status, "pendente"));
  if (activeFilter.key === "aprovados") conditions.push(eq(schema.users.status, "aprovado"));
  if (activeFilter.key === "suspensos") conditions.push(eq(schema.users.status, "suspenso"));
  if (activeFilter.key === "fornecedores") conditions.push(eq(schema.users.role, "fornecedor"));
  if (activeFilter.key === "compradores") conditions.push(eq(schema.users.role, "comprador"));

  const usersWithCompany = await db.query.users.findMany({
    where: and(...conditions),
    orderBy: (u, { desc }) => [desc(u.createdAt)],
    with: { company: { with: { kycDocuments: true } } },
  });

  // KYC documents live in a private bucket (see lib/storage.ts) — sign a short-lived URL for
  // each one here, after requireUser(["admin"]) above already confirmed this viewer is allowed
  // to see them, rather than storing/reusing a permanent public link.
  const users = await Promise.all(
    usersWithCompany.map(async (user) => {
      if (!user.company) return user;
      const kycDocuments = await Promise.all(
        user.company.kycDocuments.map(async (doc) => ({
          ...doc,
          fileUrl: await getSignedDocumentUrl(doc.fileUrl),
        })),
      );
      return { ...user, company: { ...user.company, kycDocuments } };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Usuários</h1>
        <p className="mt-1 text-muted-foreground">Contas de compradores e fornecedores, com aprovação e KYC.</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/usuarios?filtro=${f.key}`}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium",
              activeFilter.key === f.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{users.length} contas</CardTitle>
          <CardDescription>Aprovação/rejeição dispara e-mail automático ao usuário.</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma conta nesta lista.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{user.company?.nomeFantasia ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </TableCell>
                    <TableCell>{user.company ? formatCnpj(user.company.cnpj) : "—"}</TableCell>
                    <TableCell className="capitalize">{user.role}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[user.status]}>{STATUS_LABELS[user.status]}</Badge>
                      {user.status === "rejeitado" && user.rejectionReason && (
                        <p className="mt-1 max-w-48 text-xs text-muted-foreground">{user.rejectionReason}</p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {user.company && (
                          <KycDocumentsDialog companyName={user.company.nomeFantasia} documents={user.company.kycDocuments} />
                        )}
                        {user.status === "pendente" && (
                          <>
                            <form
                              action={async () => {
                                "use server";
                                await approveUserAction(user.id);
                              }}
                            >
                              <Button type="submit" size="sm">
                                Aprovar
                              </Button>
                            </form>
                            <RejectUserDialog userId={user.id} companyName={user.company?.nomeFantasia ?? user.email} />
                          </>
                        )}
                        {user.status === "aprovado" && (
                          <form
                            action={async () => {
                              "use server";
                              await suspendUserAction(user.id);
                            }}
                          >
                            <Button type="submit" size="sm" variant="outline">
                              Suspender
                            </Button>
                          </form>
                        )}
                        {user.status === "suspenso" && (
                          <form
                            action={async () => {
                              "use server";
                              await reactivateUserAction(user.id);
                            }}
                          >
                            <Button type="submit" size="sm" variant="outline">
                              Reativar
                            </Button>
                          </form>
                        )}
                        {(user.status === "aprovado" || user.status === "suspenso") && (
                          <ResetPasswordButton userId={user.id} userEmail={user.email} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
