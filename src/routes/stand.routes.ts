import { InternalUserRole } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { redeemSchema, standSearchSchema } from "../schemas/stand.schemas";
import { participationService } from "../services/participation.service";

export const standRouter = Router();

standRouter.use(
  requireAuth,
  requireRoles([InternalUserRole.SUPER_ADMIN, InternalUserRole.ADMIN, InternalUserRole.STAND_OPERATOR])
);

standRouter.post("/search-participant", validateBody(standSearchSchema), async (request, response, next) => {
  try {
    const result = await participationService.searchForStand(
      request.body.document,
      request.body.eventCode,
      request
    );

    response.json({
      participationId: result.participation.id,
      event: {
        id: result.participation.event.id,
        code: result.participation.event.code,
        name: result.participation.event.name
      },
      participant: result.participant,
      result: result.participation.result,
      resultMessage: result.participation.resultMessage,
      redeemed: result.participation.redeemed,
      prize: result.participation.prize
        ? {
            id: result.participation.prize.id,
            name: result.participation.prize.name
          }
        : null
    });
  } catch (error) {
    next(error);
  }
});

standRouter.post("/redeem-participation", validateBody(redeemSchema), async (request, response, next) => {
  try {
    const result = await participationService.redeem(request.body.participationId, request);
    response.json(result);
  } catch (error) {
    next(error);
  }
});
