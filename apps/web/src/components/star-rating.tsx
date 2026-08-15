import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({ value, size = "sm" }: { value: number; size?: "sm" | "lg" }) {
  const starSize = size === "lg" ? "size-5" : "size-3.5";
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value.toFixed(1)} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(starSize, i < Math.round(value) ? "fill-primary text-primary" : "text-muted-foreground/30")}
        />
      ))}
    </div>
  );
}
