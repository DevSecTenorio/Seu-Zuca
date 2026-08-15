import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/require-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StarRating } from "@/components/star-rating";
import { formatDate } from "@/lib/format";
import { approveReviewAction, rejectReviewAction } from "@/server/actions/review-actions";

export const metadata: Metadata = { title: "Avaliações — Admin — Seu Zuca" };

export default async function AdminReviewsPage() {
  await requireUser(["admin"]);

  const reviews = await db.query.reviews.findMany({
    where: eq(schema.reviews.moderationStatus, "pendente"),
    orderBy: (r, { asc }) => [asc(r.createdAt)],
    with: { product: true, buyer: { with: { company: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Avaliações</h1>
        <p className="mt-1 text-muted-foreground">Fila de moderação de avaliações enviadas por compradores.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{reviews.length} aguardando moderação</CardTitle>
          <CardDescription>Aprovadas passam a contar na nota média do produto.</CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma avaliação pendente.</p>
          ) : (
            <ul className="space-y-4">
              {reviews.map((review) => (
                <li key={review.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={`/produto/${review.product.slug}`} target="_blank" className="font-medium text-foreground hover:underline">
                        {review.product.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {review.buyer.company?.nomeFantasia ?? review.buyer.email} · {formatDate(review.createdAt)}
                      </p>
                      <div className="mt-1">
                        <StarRating value={review.rating} />
                      </div>
                      {review.comment && <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <form
                        action={async () => {
                          "use server";
                          await approveReviewAction(review.id);
                        }}
                      >
                        <Button type="submit" size="sm">
                          Aprovar
                        </Button>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await rejectReviewAction(review.id);
                        }}
                      >
                        <Button type="submit" size="sm" variant="outline" className="text-destructive">
                          Rejeitar
                        </Button>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
