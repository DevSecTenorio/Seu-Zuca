import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "seu-zuca-uploads";
// Separate (private) bucket for KYC documents — RG, cartão CNPJ, contrato social. Unlike
// SUPABASE_STORAGE_BUCKET (product images, banners — public by design), this bucket has
// `public: false`, so its objects are never reachable via a plain public URL. Access only
// through getSignedDocumentUrl() below, after the caller has already checked the requester is
// the document's own company or an admin/suporte account (CLAUDE.md: "Autorização SEMPRE
// verificada no servidor").
const SUPABASE_KYC_BUCKET = process.env.SUPABASE_KYC_BUCKET || "seu-zuca-kyc";
// Same private-bucket reasoning as SUPABASE_KYC_BUCKET, but for supplier-uploaded nota fiscal
// files — these carry buyer/supplier tax data and must only be reachable by the order's own
// buyer/supplier or an admin/suporte account, via a signed URL.
const SUPABASE_INVOICE_BUCKET = process.env.SUPABASE_INVOICE_BUCKET || "seu-zuca-invoices";

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  // Service role key bypasses Row Level Security — only ever used server-side, never sent to
  // the client (CLAUDE.md: never hardcode/leak credentials).
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

/**
 * Uploads a file and returns its public URL.
 *
 * Production: Supabase Storage (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set), storing under
 * `<bucket>/<folder>/<uuid>.<ext>` in a public bucket — matches the "unguessable path, no ACL
 * check" posture the KYC upload flow already had with the previous Vercel Blob integration.
 * Local dev without those vars: falls back to writing under public/uploads so the flow can be
 * exercised without provisioning cloud storage — never used in production (no persistent
 * filesystem there).
 */
export async function uploadFile(file: File, folder: string): Promise<string> {
  const extension = path.extname(file.name) || "";
  const key = `${folder}/${randomUUID()}${extension}`;

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(key, file, { contentType: file.type || undefined, upsert: false });
    if (error) {
      throw new Error(`Falha ao enviar arquivo para o Supabase Storage: ${error.message}`);
    }
    const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(key);
    return data.publicUrl;
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, path.basename(key));
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);
  return `/uploads/${folder}/${path.basename(key)}`;
}

/**
 * Uploads a file to a private bucket and returns its **storage path** (not a URL — the bucket
 * has no public access, so the path alone is useless without a signed URL from
 * getSignedUrlForPrivateFile()). Local dev fallback (no Supabase configured) still writes under
 * public/uploads for convenience, same as uploadFile() — never used in production. Shared by
 * uploadKycDocument and uploadInvoiceDocument, which only differ by target bucket.
 */
async function uploadToPrivateBucket(file: File, folder: string, bucket: string, errorLabel: string): Promise<string> {
  const extension = path.extname(file.name) || "";
  const key = `${folder}/${randomUUID()}${extension}`;

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(key, file, { contentType: file.type || undefined, upsert: false });
    if (error) {
      throw new Error(`Falha ao enviar ${errorLabel} para o Supabase Storage: ${error.message}`);
    }
    return key;
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, path.basename(key));
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);
  return `/uploads/${folder}/${path.basename(key)}`;
}

export async function uploadKycDocument(file: File, folder: string): Promise<string> {
  return uploadToPrivateBucket(file, folder, SUPABASE_KYC_BUCKET, "documento de KYC");
}

export async function uploadInvoiceDocument(file: File, folder: string): Promise<string> {
  return uploadToPrivateBucket(file, folder, SUPABASE_INVOICE_BUCKET, "nota fiscal");
}

/**
 * Resolves a stored file_url/path into something a browser can actually load. A value from the
 * local-dev fallback is already a servable relative path (`/uploads/...`) — returned as-is.
 * Anything else is a path inside the given private bucket, signed on demand so the link expires
 * shortly after being handed to an already-authorized viewer.
 */
async function getSignedUrlForPrivateFile(bucket: string, fileUrlOrPath: string, expiresInSeconds: number, errorLabel: string): Promise<string> {
  if (fileUrlOrPath.startsWith("/") || fileUrlOrPath.startsWith("http")) {
    return fileUrlOrPath;
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return fileUrlOrPath;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(fileUrlOrPath, expiresInSeconds);
  if (error || !data) {
    throw new Error(`Falha ao gerar link assinado para ${errorLabel}: ${error?.message}`);
  }
  return data.signedUrl;
}

/** Signs a value stored in kyc_documents.file_url — see getSignedUrlForPrivateFile(). */
export async function getSignedDocumentUrl(fileUrlOrPath: string, expiresInSeconds = 600): Promise<string> {
  return getSignedUrlForPrivateFile(SUPABASE_KYC_BUCKET, fileUrlOrPath, expiresInSeconds, "o documento de KYC");
}

/** Signs a value stored in orders.invoice_url — see getSignedUrlForPrivateFile(). */
export async function getSignedInvoiceUrl(fileUrlOrPath: string, expiresInSeconds = 600): Promise<string> {
  return getSignedUrlForPrivateFile(SUPABASE_INVOICE_BUCKET, fileUrlOrPath, expiresInSeconds, "a nota fiscal");
}
