import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/require-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { suspendUserAction, reactivateUserAction } from "@/server/actions/user-management-actions";
import { ResetPasswordButton } from "../usuarios/reset-password-button";
import { CreateInternalUserForm } from "./create-internal-user-form";

export const metadata: Metadata = { title: "Usuários Internos — Admin — Seu Zuca" };

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin — acesso total à plataforma",
  suporte: "Suporte — consulta dados, somente leitura",
};

export default async function InternalUsersPage() {
  await requireUser(["admin"]);

  const users = await db.query.users.findMany({
    where: inArray(schema.users.role, ["admin", "suporte"]),
    orderBy: (u, { desc }) => [desc(u.createdAt)],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Usuários internos</h1>
          <p className="mt-1 text-muted-foreground">Contas de administradores e da equipe de suporte.</p>
        </div>
        <CreateInternalUserForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{users.length} contas</CardTitle>
          <CardDescription>
            <strong>Admin</strong> tem acesso total (moderação, configurações, relatórios).{" "}
            <strong>Suporte</strong> só consulta dados — o servidor rejeita qualquer mutação vinda dessa conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-foreground">{user.email}</TableCell>
                  <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === "suspenso" ? "secondary" : "default"}>
                      {user.status === "suspenso" ? "Suspenso" : "Ativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Nunca acessou"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ResetPasswordButton userId={user.id} userEmail={user.email} />
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
