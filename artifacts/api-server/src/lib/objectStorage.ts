import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import type { IncomingMessage } from "node:http";

// Allowed MIME types for uploads
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
];

// Max upload size: 10 MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Issues a client upload token so the browser can PUT the file straight to
 * Vercel Blob, bypassing the ~4.5MB request body limit of serverless
 * functions. Intentionally unauthenticated: buyers/suppliers upload CNPJ
 * documents during registration, before an account exists.
 */
export async function generateUploadToken(
  body: HandleUploadBody,
  request: IncomingMessage,
) {
  return handleUpload({
    body,
    request,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: ALLOWED_MIME_TYPES,
      maximumSizeInBytes: MAX_FILE_SIZE,
      addRandomSuffix: true,
    }),
    onUploadCompleted: async () => {
      // No server-side bookkeeping needed: the caller persists the returned
      // blob URL itself (product form / registration) once the upload resolves.
    },
  });
}
