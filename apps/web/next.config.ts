import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Registration uploads up to 3 KYC documents (10MB each, validated in
      // src/lib/validation/files.ts) in a single server action call.
      bodySizeLimit: "30mb",
    },
  },
  images: {
    remotePatterns: [
      // Real uploads (product images, banners) go to Supabase Storage's public bucket URLs.
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      // Seed/demo banner imagery only — picsum.photos placeholders until admin uploads real
      // banner photos through the storage flow (see src/lib/storage.ts). Seed product images use
      // local, category-correct SVGs (public/placeholders/) instead — see db/seed.ts.
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
    // Only ever serves our own build-time-generated SVGs (public/placeholders/), never
    // user/fornecedor-uploaded content, so the usual XSS risk of optimizing arbitrary SVGs doesn't apply.
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
