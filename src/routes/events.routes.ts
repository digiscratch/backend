import { InternalUserRole } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { eventPatchSchema, eventSchema } from "../schemas/event.schemas";
import { auditService } from "../services/audit.service";

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
