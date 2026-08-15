import { CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";

export type OrderStatusEvent = { id: string; status: string; note: string | null; createdAt: Date };

export function OrderTimeline({ events }: { events: OrderStatusEvent[] }) {
  return (
    <ol className="space-y-4">
      {events.map((event, i) => (
        <li key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <CheckCircle2 className="size-5 shrink-0 text-primary" />
            {i < events.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
          </div>
          <div className="pb-4">
            <p className="text-sm font-medium text-foreground">
              {ORDER_STATUS_LABELS[event.status as OrderStatus] ?? event.status}
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</p>
            {event.note && <p className="mt-1 text-sm text-muted-foreground">{event.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
