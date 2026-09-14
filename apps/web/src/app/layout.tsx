import type { Metadata } from "next";
import { Inter, Oswald, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// This app is session/cookie-driven on every route (header shows different auth state per
// request); force dynamic rendering everywhere so the build never attempts to statically
// prerender a page and query the database at build time, when DATABASE_URL (a Vercel Sensitive
// env var) isn't available.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Seu Zuca — Marketplace B2B de Materiais de Construção",
    template: "%s",
  },
  description:
    "Marketplace B2B exclusivo para pessoas jurídicas que conecta fornecedores de materiais de construção a construtoras e empreiteiras.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${oswald.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Header />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
