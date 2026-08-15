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
      // Real uploads (product images, banners) go to Vercel Blob's public CDN.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      // Seed/demo imagery only — picsum.photos placeholders until suppliers/admin upload real
      // photos through the storage flow (see src/lib/storage.ts).
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
};

export default nextConfig;
