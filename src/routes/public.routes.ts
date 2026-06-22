import { Router } from "express";
import { env } from "../config/env";
import { rateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import { validateBody, validateQuery } from "../middlewares/validate.middleware";
import { participateSchema, publicResultQuerySchema } from "../schemas/public.schemas";
import { participationService } from "../services/participation.service";

export const publicRouter = Router();

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
