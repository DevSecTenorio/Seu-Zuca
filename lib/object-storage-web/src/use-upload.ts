import { useCallback, useState } from "react";
import { upload } from "@vercel/blob/client";

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

interface UploadResponse {
  /** Absolute, publicly reachable URL of the uploaded file. */
  objectPath: string;
  metadata: UploadMetadata;
}

interface UseUploadOptions {
  /** Base path where object storage routes are mounted (default: "/api/storage") */
  basePath?: string;
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * React hook for uploading files straight to Vercel Blob from the browser.
 *
 * The file goes directly from the browser to Blob storage (not through this
 * server), avoiding the ~4.5MB request body limit of serverless functions.
 * `basePath + "/uploads/request-url"` is the server route that authorizes
 * the upload and hands out a short-lived client token.
 *
 * @example
 * ```tsx
 * function FileUploader() {
 *   const { uploadFile, isUploading, error } = useUpload({
 *     onSuccess: (response) => {
 *       console.log("Uploaded to:", response.objectPath);
 *     },
 *   });
 *
 *   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *     const file = e.target.files?.[0];
 *     if (file) {
 *       await uploadFile(file);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <input type="file" onChange={handleFileChange} disabled={isUploading} />
 *       {isUploading && <p>Uploading...</p>}
 *       {error && <p>Error: {error.message}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useUpload(options: UseUploadOptions = {}) {
  const basePath = options.basePath ?? "/api/storage";
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: `${basePath}/uploads/request-url`,
          onUploadProgress: ({ percentage }) => setProgress(percentage),
        });

        const uploadResponse: UploadResponse = {
          objectPath: blob.url,
          metadata: {
            name: file.name,
            size: file.size,
            contentType: file.type || "application/octet-stream",
          },
        };

        setProgress(100);
        options.onSuccess?.(uploadResponse);
        return uploadResponse;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [basePath, options]
  );

  return {
    uploadFile,
    isUploading,
    error,
    progress,
  };
}
