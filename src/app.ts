import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.middleware";
import { rateLimitMiddleware } from "./middlewares/rate-limit.middleware";
import { requestContextMiddleware } from "./middlewares/request-context.middleware";
import { auditRouter } from "./routes/audit.routes";
import { authRouter } from "./routes/auth.routes";
import { eventsRouter } from "./routes/events.routes";
import { prizesRouter } from "./routes/prizes.routes";
import { publicRouter } from "./routes/public.routes";
import { standRouter } from "./routes/stand.routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(requestContextMiddleware);
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin not allowed by CORS."));
      }
    })
  );
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(
    rateLimitMiddleware(
      "global",
      env.GLOBAL_RATE_LIMIT_MAX_REQUESTS,
      env.GLOBAL_RATE_LIMIT_WINDOW_SECONDS
    )
  );

  app.get("/health", async (_request, response) => {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/version", (_request, response) => {
    response.json({ version: env.APP_VERSION });
  });

  app.use("/auth", authRouter);
  app.use("/events", eventsRouter);
  app.use("/admin/prizes", prizesRouter);
  app.use("/public", publicRouter);
  app.use("/stand", standRouter);
  app.use("/audit-logs", auditRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, shutting down gracefully");
    await prisma.$disconnect();
  });

  return app;
}
