"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRatingInput({ name, defaultValue = 0 }: { name: string; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Nota">
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={n}
            checked={value === n}
            onChange={() => setValue(n)}
            className="sr-only"
            required
          />
          <Star
            className={cn(
              "size-7 transition-colors",
              (hover || value) >= n ? "fill-primary text-primary" : "text-muted-foreground/30",
            )}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
          />
        </label>
      ))}
    </div>
  );
}
