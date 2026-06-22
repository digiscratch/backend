import { ParticipationResult, Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { participantService, type ParticipantInput } from "./participant.service";
import { auditService } from "./audit.service";
import { documentHashService } from "./hash.service";

export class ParticipationService {
  async participate(eventCode: string, input: ParticipantInput, request: Request) {
    const event = await prisma.event.findUnique({
      where: { code: eventCode },
      include: { prizes: { where: { isActive: true } } }
    });

    if (!event || !event.isActive) {
      throw new HttpError(404, "EVENT_NOT_FOUND", "Event not found.");
    }

    const now = new Date();
    if (event.startsAt > now || event.endsAt < now) {
      throw new HttpError(400, "EVENT_INACTIVE", "Event is not active.");
    }

    const documentHash = documentHashService.hashDocument(input.document);
    const existing = await prisma.participation.findUnique({
      where: {
        eventId_documentHash: {
          eventId: event.id,
          documentHash
        }
      },
      include: {
        prize: true
      }
    });

    if (existing) {
      return existing;
    }

    const participantPayload = participantService.createParticipantData(input);

    const participation = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let participant = await tx.participant.findUnique({
        where: { documentHash: participantPayload.documentHash }
      });

      if (!participant) {
        participant = await tx.participant.create({ data: participantPayload.participantData });
      }

      const availablePrizes = await tx.prize.findMany({
        where: {
          eventId: event.id,
          isActive: true,
          stockAvailable: { gt: 0 }
        },
        orderBy: { createdAt: "asc" }
      });

      const winningPool = [...availablePrizes, null];
      const selected = winningPool[Math.floor(Math.random() * winningPool.length)] ?? null;

      let prizeId: string | null = null;
      let result: ParticipationResult = ParticipationResult.NO_PRIZE;
      let resultMessage = "Gracias por participar";

      if (selected) {
        const updated = await tx.prize.updateMany({
          where: { id: selected.id, stockAvailable: { gt: 0 } },
          data: { stockAvailable: { decrement: 1 } }
        });

        if (updated.count > 0) {
          prizeId = selected.id;
          result = ParticipationResult.WINNER;
          resultMessage = `Ganaste ${selected.name}`;
        }
      }

      const created = await tx.participation.create({
        data: {
          eventId: event.id,
          participantId: participant.id,
          documentHash,
          prizeId,
          result,
          resultMessage
        },
        include: {
          prize: true
        }
      });

      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await auditService.log({
      action: "PARTICIPATION_CREATED",
      entityType: "participation",
      entityId: participation.id,
      request,
      metadata: {
        eventCode,
        result: participation.result
      }
    });

    if (participation.prizeId) {
      await auditService.log({
        action: "PRIZE_ASSIGNED",
        entityType: "participation",
        entityId: participation.id,
        request,
        metadata: {
          prizeId: participation.prizeId
        }
      });
    }

    return participation;
  }

  async getPublicResult(eventCode: string, document: string) {
    const event = await prisma.event.findUnique({ where: { code: eventCode } });

    if (!event) {
      throw new HttpError(404, "EVENT_NOT_FOUND", "Event not found.");
    }

    const documentHash = documentHashService.hashDocument(document);
    const participation = await prisma.participation.findUnique({
      where: {
        eventId_documentHash: {
          eventId: event.id,
          documentHash
        }
      },
      include: { prize: true }
    });

    if (!participation) {
      throw new HttpError(404, "PARTICIPATION_NOT_FOUND", "Participation not found.");
    }

    return participation;
  }

  async searchForStand(document: string, eventCode: string | undefined, request: Request) {
    const documentHash = documentHashService.hashDocument(document);
    const participation = await prisma.participation.findFirst({
      where: {
        documentHash,
        event: eventCode ? { code: eventCode } : undefined
      },
      include: {
        prize: true,
        event: true,
        participant: true
      },
      orderBy: { createdAt: "desc" }
    });

    if (!participation) {
      throw new HttpError(404, "PARTICIPATION_NOT_FOUND", "Participant not found.");
    }

    await auditService.log({
      actorUserId: request.auth?.userId,
      actorEmail: request.auth?.email,
      actorRole: request.auth?.role,
      action: "SENSITIVE_DATA_ACCESSED",
      entityType: "participant",
      entityId: participation.participantId,
      request
    });

    return {
      participation,
      participant: participantService.decryptParticipant(participation.participant)
    };
  }

  async redeem(participationId: string, request: Request) {
    const existing = await prisma.participation.findUnique({
      where: { id: participationId },
      include: { prize: true }
    });

    if (!existing) {
      throw new HttpError(404, "PARTICIPATION_NOT_FOUND", "Participation not found.");
    }

    if (!existing.prizeId) {
      throw new HttpError(400, "NO_PRIZE", "Participation has no prize assigned.");
    }

    if (existing.redeemed) {
      await auditService.log({
        actorUserId: request.auth?.userId,
        actorEmail: request.auth?.email,
        actorRole: request.auth?.role,
        action: "DUPLICATE_REDEMPTION_ATTEMPT",
        entityType: "participation",
        entityId: existing.id,
        request
      });
      throw new HttpError(409, "ALREADY_REDEEMED", "Participation was already redeemed.");
    }

    const updated = await prisma.participation.update({
      where: { id: participationId },
      data: {
        redeemed: true,
        redeemedAt: new Date(),
        redeemedByUserId: request.auth?.userId
      },
      include: { prize: true }
    });

    await auditService.log({
      actorUserId: request.auth?.userId,
      actorEmail: request.auth?.email,
      actorRole: request.auth?.role,
      action: "PRIZE_REDEEMED",
      entityType: "participation",
      entityId: updated.id,
      request,
      metadata: { prizeId: updated.prizeId }
    });

    return updated;
  }
}

export const participationService = new ParticipationService();
