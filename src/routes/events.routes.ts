import { InternalUserRole } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { eventPatchSchema, eventSchema } from "../schemas/event.schemas";
import { auditService } from "../services/audit.service";
import { participantService } from "../services/participant.service";

export const eventsRouter = Router();

eventsRouter.get("/", async (_request, response, next) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { startsAt: "desc" }
    });
    response.json(events);
  } catch (error) {
    next(error);
  }
});

eventsRouter.get(
  "/:id/stats",
  requireAuth,
  requireRoles([InternalUserRole.SUPER_ADMIN, InternalUserRole.ADMIN]),
  async (request, response, next) => {
    try {
      const event = await prisma.event.findUniqueOrThrow({
        where: { id: request.params.id as string },
        include: {
          prizes: { orderBy: { createdAt: "asc" } },
          participations: {
            include: {
              participant: true,
              prize: true
            },
            orderBy: { createdAt: "desc" }
          }
        }
      });

      await auditService.log({
        actorUserId: request.auth?.userId,
        actorEmail: request.auth?.email,
        actorRole: request.auth?.role,
        action: "SENSITIVE_DATA_ACCESSED",
        entityType: "event",
        entityId: event.id,
        request,
        metadata: {
          scope: "event_participants",
          participationCount: event.participations.length
        }
      });

      response.json({
        event: {
          id: event.id,
          code: event.code,
          name: event.name,
          description: event.description,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          isActive: event.isActive
        },
        prizes: event.prizes.map((prize) => ({
          id: prize.id,
          eventId: prize.eventId,
          name: prize.name,
          description: prize.description,
          stockTotal: prize.stockTotal,
          stockAvailable: prize.stockAvailable,
          isActive: prize.isActive
        })),
        participations: event.participations.map((participation) => ({
          id: participation.id,
          result: participation.result,
          resultMessage: participation.resultMessage,
          redeemed: participation.redeemed,
          createdAt: participation.createdAt,
          redeemedAt: participation.redeemedAt,
          prize: participation.prize
            ? {
                id: participation.prize.id,
                name: participation.prize.name
              }
            : null,
          participant: participantService.decryptParticipant(participation.participant)
        }))
      });
    } catch (error) {
      next(error);
    }
  }
);

eventsRouter.get("/:id", async (request, response, next) => {
  try {
    const event = await prisma.event.findUniqueOrThrow({
      where: { id: request.params.id as string },
      include: { prizes: true }
    });
    response.json(event);
  } catch (error) {
    next(error);
  }
});

eventsRouter.post(
  "/",
  requireAuth,
  requireRoles([InternalUserRole.SUPER_ADMIN, InternalUserRole.ADMIN]),
  validateBody(eventSchema),
  async (request, response, next) => {
    try {
      const event = await prisma.event.create({
        data: {
          code: request.body.code,
          name: request.body.name,
          description: request.body.description,
          startsAt: new Date(request.body.startsAt),
          endsAt: new Date(request.body.endsAt),
          isActive: request.body.isActive ?? true
        }
      });

      await auditService.log({
        actorUserId: request.auth?.userId,
        actorEmail: request.auth?.email,
        actorRole: request.auth?.role,
        action: "EVENT_CREATED",
        entityType: "event",
        entityId: event.id,
        newValue: event,
        request
      });

      response.status(201).json(event);
    } catch (error) {
      next(error);
    }
  }
);

eventsRouter.patch(
  "/:id",
  requireAuth,
  requireRoles([InternalUserRole.SUPER_ADMIN, InternalUserRole.ADMIN]),
  validateBody(eventPatchSchema),
  async (request, response, next) => {
    try {
      const previous = await prisma.event.findUniqueOrThrow({ where: { id: request.params.id as string } });
      const event = await prisma.event.update({
        where: { id: request.params.id as string },
        data: {
          ...request.body,
          startsAt: request.body.startsAt ? new Date(request.body.startsAt) : undefined,
          endsAt: request.body.endsAt ? new Date(request.body.endsAt) : undefined
        }
      });

      await auditService.log({
        actorUserId: request.auth?.userId,
        actorEmail: request.auth?.email,
        actorRole: request.auth?.role,
        action: "EVENT_UPDATED",
        entityType: "event",
        entityId: event.id,
        previousValue: previous,
        newValue: event,
        request
      });

      response.json(event);
    } catch (error) {
      next(error);
    }
  }
);
