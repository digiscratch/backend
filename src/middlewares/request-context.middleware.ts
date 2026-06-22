import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import pinoHttp from "pino-http";
import { logger } from "../lib/logger";

const httpLogger = pinoHttp({
  logger,
  genReqId: (request) => (request.headers["x-request-id"] as string | undefined) ?? randomUUID()
});

export function requestContextMiddleware(request: Request, response: Response, next: NextFunction): void {
  httpLogger(request, response);
  request.requestId = String(request.id);
  response.setHeader("x-request-id", request.requestId);
  next();
}
