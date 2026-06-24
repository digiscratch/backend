import { InternalUserRole } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { prizeInventorySchema, prizePatchSchema, prizeSchema } from "../schemas/prize.schemas";
import { auditService } from "../services/audit.service";

export const prizesRouter = Router();

prizesRouter.use(requireAuth, requireRoles([InternalUserRole.SUPER_ADMIN, InternalUserRole.ADMIN]));

prizesRouter.get("/", async (request, response, next) => {
  try {
    const prizes = await prisma.prize.findMany({
      include: { event: true },
      orderBy: { createdAt: "desc" }
    });
    response.json(prizes);
  } catch (error) {
    next(error);
  }
});

prizesRouter.post("/", validateBody(prizeSchema), async (request, response, next) => {
  try {
    const stockAvailable = request.body.stockAvailable ?? request.body.stockTotal;
    const prize = await prisma.prize.create({
      data: {
        eventId: request.body.eventId,
        name: request.body.name,
        description: request.body.description,
        stockTotal: request.body.stockTotal,
        stockAvailable,
        isActive: request.body.isActive ?? true
      }
    });

    await auditService.log({
      actorUserId: request.auth?.userId,
      actorEmail: request.auth?.email,
      actorRole: request.auth?.role,
      action: "PRIZE_CREATED",
      entityType: "prize",
      entityId: prize.id,
      newValue: prize,
      request
    });

    response.status(201).json(prize);
  } catch (error) {
    next(error);
  }
});

prizesRouter.patch("/:id", validateBody(prizePatchSchema), async (request, response, next) => {
  try {
    const previous = await prisma.prize.findUniqueOrThrow({ where: { id: request.params.id as string } });
    const prize = await prisma.prize.update({
      where: { id: request.params.id as string },
      data: request.body
    });

    await auditService.log({
      actorUserId: request.auth?.userId,
      actorEmail: request.auth?.email,
      actorRole: request.auth?.role,
      action: "PRIZE_UPDATED",
      entityType: "prize",
      entityId: prize.id,
      previousValue: previous,
      newValue: prize,
      request
    });

    response.json(prize);
  } catch (error) {
    next(error);
  }
});

prizesRouter.delete("/:id", async (request, response, next) => {
  try {
    const prize = await prisma.prize.findUniqueOrThrow({
      where: { id: request.params.id as string },
      include: { _count: { select: { participations: true } } }
    });

    if (prize.isActive) {
      throw new HttpError(409, "PRIZE_ACTIVE", "El premio debe estar inactivo antes de eliminarlo.");
    }

    if (prize._count.participations > 0) {
      throw new HttpError(
        409,
        "PRIZE_HAS_PARTICIPATIONS",
        "No se puede eliminar un premio que ya tiene participaciones asignadas."
      );
    }

    await prisma.prize.delete({
      where: { id: prize.id }
    });

    await auditService.log({
      actorUserId: request.auth?.userId,
      actorEmail: request.auth?.email,
      actorRole: request.auth?.role,
      action: "PRIZE_DELETED",
      entityType: "prize",
      entityId: prize.id,
      previousValue: prize,
      request
    });

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

prizesRouter.patch(
  "/:id/inventory",
  validateBody(prizeInventorySchema),
  async (request, response, next) => {
    try {
      const previous = await prisma.prize.findUniqueOrThrow({ where: { id: request.params.id as string } });
      const prize = await prisma.prize.update({
        where: { id: request.params.id as string },
        data: { stockAvailable: request.body.stockAvailable }
      });

      await auditService.log({
        actorUserId: request.auth?.userId,
        actorEmail: request.auth?.email,
        actorRole: request.auth?.role,
        action: "INVENTORY_UPDATED",
        entityType: "prize",
        entityId: prize.id,
        previousValue: previous,
        newValue: prize,
        request
      });

      response.json(prize);
    } catch (error) {
      next(error);
    }
  }
);
