import type { Metadata } from "next";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/require-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BannerFormDialog } from "./banner-form-dialog";
import { BannerList } from "./banner-list";

export const metadata: Metadata = { title: "Banners — Admin — Seu Zuca" };

export default async function AdminBannersPage() {
  await requireUser(["admin"]);

  const banners = await db.query.banners.findMany({ orderBy: (b, { asc }) => [asc(b.order)] });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Banners</h1>
          <p className="mt-1 text-muted-foreground">Carrossel da home — arraste para reordenar.</p>
        </div>
        <BannerFormDialog mode="create" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{banners.length} banners</CardTitle>
          <CardDescription>Apenas banners ativos aparecem no carrossel da home.</CardDescription>
        </CardHeader>
        <CardContent>
          <BannerList banners={banners} />
        </CardContent>
      </Card>
    </div>
  );
}
