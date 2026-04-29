import { Router, type IRouter, type Response } from "express";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Allowed MIME types for uploads
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
]);

// Max upload size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload. Requires authentication.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, size, contentType } = req.body ?? {};

  if (!name || typeof name !== "string" || typeof size !== "number" || !contentType || typeof contentType !== "string") {
    res.status(400).json({ error: "Campos obrigatórios: name (string), size (number), contentType (string)" });
    return;
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    res.status(400).json({
      error: `Tipo de arquivo não permitido: ${contentType}. Permitidos: ${[...ALLOWED_MIME_TYPES].join(", ")}`,
    });
    return;
  }

  // Validate file size
  if (size <= 0 || size > MAX_FILE_SIZE) {
    res.status(400).json({
      error: `Tamanho de arquivo inválido. Máximo permitido: ${MAX_FILE_SIZE / (1024 * 1024)} MB`,
    });
    return;
  }

  // Validate file name (prevent path traversal)
  const safeName = name.replace(/[^a-zA-Z0-9._\- ]/g, "_").slice(0, 255);

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    req.log.info({ userId: req.userId, safeName, size, contentType }, "Upload URL requested");

    res.json({ uploadURL, objectPath, metadata: { name: safeName, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Falha ao gerar URL de upload" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * Unconditionally public — no authentication required.
 */
router.get("/storage/public-objects/*filePath", async (req: AuthRequest, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "Arquivo não encontrado" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Falha ao servir arquivo público" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve private object entities — requires authentication.
 */
router.get("/storage/objects/*path", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Arquivo não encontrado" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Falha ao servir arquivo" });
  }
});

export default router;
