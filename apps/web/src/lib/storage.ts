import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

/**
 * Uploads a file and returns its public URL.
 *
 * Production: Vercel Blob (BLOB_READ_WRITE_TOKEN set). Local dev without a token:
 * falls back to writing under public/uploads so the flow can be exercised without
 * provisioning cloud storage — never used in production (no persistent filesystem there).
 */
export async function uploadFile(file: File, folder: string): Promise<string> {
  const extension = path.extname(file.name) || "";
  const key = `${folder}/${randomUUID()}${extension}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, file, {
      access: "public",
      addRandomSuffix: false,
    });
    return blob.url;
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, path.basename(key));
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);
  return `/uploads/${folder}/${path.basename(key)}`;
}
