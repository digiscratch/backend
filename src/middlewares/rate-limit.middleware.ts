import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error";
import { rateLimitService } from "../services/rate-limit.service";
import { getClientIp } from "../utils/request";

export function rateLimitMiddleware(prefix: string, maxAttempts: number, windowSeconds: number) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const key = `${prefix}:${getClientIp(request)}`;
    const result = await rateLimitService.check(key, maxAttempts, windowSeconds);

    response.setHeader("x-ratelimit-remaining", result.remaining.toString());
    response.setHeader("x-ratelimit-reset", new Date(result.resetAt).toISOString());

    if (!result.allowed) {
      next(new HttpError(429, "RATE_LIMITED", "Too many requests. Please try again later."));
      return;
    }

    next();
  };
}
