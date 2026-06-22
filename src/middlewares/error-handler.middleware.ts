import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";
import { HttpError } from "../lib/http-error";
import { logger } from "../lib/logger";

export function notFoundHandler(_request: Request, response: Response): void {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Resource not found."
    }
  });
}

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload.",
        details: error.flatten()
      }
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  logger.error({ error, requestId: request.requestId }, "Unhandled request error");
  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: env.isProduction ? "An unexpected error occurred." : "Unhandled server error."
    }
  });
}
