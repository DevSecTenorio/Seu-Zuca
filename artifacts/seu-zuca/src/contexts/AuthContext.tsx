import { createContext, useContext, ReactNode } from "react";
import { useGetMe } from "@workspace/api-client-react";

interface User {
  id: number;
  email: string;
  nome: string;
  role: "admin" | "buyer" | "supplier";
  status: "pending" | "approved" | "rejected" | "suspended";
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  telefone?: string;
  ramo?: string;
  emailVerificado?: boolean;
  stripeAccountId?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isBuyer: boolean;
  isSupplier: boolean;
  isApprovedBuyer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, error } = useGetMe({
    query: {
      retry: false,
    }
  });

  const validUser = error ? null : (user ?? null);

  const value: AuthContextType = {
    user: validUser as User | null,
    isLoading,
    isAuthenticated: !!validUser,
    isAdmin: validUser?.role === "admin",
    isBuyer: validUser?.role === "buyer",
    isSupplier: validUser?.role === "supplier",
    isApprovedBuyer: validUser?.role === "buyer" && validUser?.status === "approved",
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
