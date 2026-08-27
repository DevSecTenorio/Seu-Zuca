import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import helmet from "helmet";
import router from "./routes";
import { logger } from "./lib/logger";
import { csrfMiddleware } from "./middlewares/csrf";
import { sanitizeMiddleware } from "./middlewares/sanitize";

const app: Express = express();

// ── Security headers (Helmet) ────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// ── Request logging ──────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── CORS — restrict to known origins ────────────────────────────────────────
const allowedOrigins: (string | RegExp)[] = (() => {
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    return domains.split(",").map((d) => `https://${d.trim()}`);
  }
  if (process.env.VERCEL_URL) {
    return [`https://${process.env.VERCEL_URL}`];
  }
  return [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/.*\.replit\.dev$/];
})();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const ok = allowedOrigins.some((a) =>
        typeof a === "string" ? a === origin : a.test(origin),
      );
      callback(ok ? null : new Error("Not allowed by CORS"), ok);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    exposedHeaders: ["X-CSRF-Token"],
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

// ── CSRF protection ──────────────────────────────────────────────────────────
app.use(csrfMiddleware);

// ── Input sanitization ───────────────────────────────────────────────────────
app.use(sanitizeMiddleware);

app.use("/api", router);

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Endpoint não encontrado" });
});

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ message: "Erro interno do servidor" });
});

export default app;
