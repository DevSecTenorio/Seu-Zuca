import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "seu-zuca-uploads";

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
