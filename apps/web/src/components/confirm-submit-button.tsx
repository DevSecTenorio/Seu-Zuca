"use client";

import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

/** Submit button that asks for a native confirm() before letting the form post — used for
 * destructive admin actions (delete category/unit, reject product) where a full AlertDialog
 * would be overkill. */
export function ConfirmSubmitButton({
  confirmMessage,
  onClick,
  ...props
}: ComponentProps<typeof Button> & { confirmMessage: string }) {
  return (
    <Button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    />
  );
}
