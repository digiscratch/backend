import { Router } from "express";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { rateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import { validateBody, validateQuery } from "../middlewares/validate.middleware";
import { participateSchema, publicResultQuerySchema } from "../schemas/public.schemas";
import { participationService } from "../services/participation.service";

export const publicRouter = Router();

publicRouter.get("/events/:eventCode", async (request, response, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { code: request.params.eventCode as string },
      include: {
        prizes: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    });

    if (!event) {
      throw new HttpError(404, "EVENT_NOT_FOUND", "Event not found.");
    }

    const now = new Date();
    const isAvailable = event.isActive && event.startsAt <= now && event.endsAt >= now;

    response.json({
      id: event.id,
      code: event.code,
      name: event.name,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      isActive: event.isActive,
      isAvailable,
      prizes: event.prizes
    });
  } catch (error) {
    next(error);
  }
});

publicRouter.post(
  "/events/:eventCode/participate",
  rateLimitMiddleware(
    "participation",
    env.PARTICIPATION_RATE_LIMIT_MAX_REQUESTS,
    env.PARTICIPATION_RATE_LIMIT_WINDOW_SECONDS
  ),
  validateBody(participateSchema),
  async (request, response, next) => {
    try {
      const result = await participationService.participate(
        request.params.eventCode as string,
        request.body,
        request
      );
      response.status(201).json({
        id: result.id,
        result: result.result,
        resultMessage: result.resultMessage,
        prize: result.prize ? { id: result.prize.id, name: result.prize.name } : null,
        redeemed: result.redeemed
      });
    } catch (error) {
      next(error);
    }
  }
);

publicRouter.get(
  "/events/:eventCode/result",
  validateQuery(publicResultQuerySchema),
  async (request, response, next) => {
    try {
      const result = await participationService.getPublicResult(
        request.params.eventCode as string,
        request.query.document as string
      );
      response.json({
        id: result.id,
        result: result.result,
        resultMessage: result.resultMessage,
        prize: result.prize ? { id: result.prize.id, name: result.prize.name } : null,
        redeemed: result.redeemed
      });
    } catch (error) {
      next(error);
    }
  }
);
