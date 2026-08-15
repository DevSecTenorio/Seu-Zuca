import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/auth-actions";

export function LogoutButton({ variant = "outline" }: { variant?: "outline" | "ghost" | "default" }) {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant={variant}>
        <LogOut className="size-4" />
        Sair
      </Button>
    </form>
  );
}
