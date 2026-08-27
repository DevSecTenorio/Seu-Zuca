import { Router, type IRouter, type Request, type Response } from "express";
import type { HandleUploadBody } from "@vercel/blob/client";
import { generateUploadToken } from "../lib/objectStorage";

const router: IRouter = Router();

/**
 * POST /storage/uploads/request-url
 *
 * Issues a Vercel Blob client upload token so the browser can upload the
 * file directly to Blob storage. Open to unauthenticated users (needed
 * during registration to upload CNPJ docs).
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  try {
    const jsonResponse = await generateUploadToken(req.body as HandleUploadBody, req);
    res.json(jsonResponse);
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload token");
    res.status(400).json({ error: (error as Error).message || "Falha ao gerar token de upload" });
  }
});

export default router;
