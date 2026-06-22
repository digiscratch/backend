import type { Prisma, InternalUserRole } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../lib/prisma";
import { sha256 } from "../utils/security";
import { getClientIp } from "../utils/request";
import { logWebhookService } from "./log-webhook.service";

interface AuditInput {
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: InternalUserRole | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
  request?: Request;
}

export class AuditService {
  private createIntegrityHash(payload: Omit<AuditInput, "request"> & { timestamp: string }): string {
    return sha256(
      JSON.stringify({
        actorUserId: payload.actorUserId ?? null,
        actorEmail: payload.actorEmail ?? null,
        actorRole: payload.actorRole ?? null,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        previousValue: payload.previousValue ?? null,
        newValue: payload.newValue ?? null,
        metadata: payload.metadata ?? null,
        timestamp: payload.timestamp
      })
    );
  }

  async log(input: AuditInput): Promise<void> {
    const timestamp = new Date().toISOString();
    const hashIntegrity = this.createIntegrityHash({ ...input, timestamp });

    const record = await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorEmail: input.actorEmail ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        ipAddress: input.request ? getClientIp(input.request) : null,
        userAgent: input.request?.get("user-agent") ?? null,
        requestId: input.request?.requestId ?? null,
        previousValue: input.previousValue ?? undefined,
        newValue: input.newValue ?? undefined,
        metadata: input.metadata ?? undefined,
        hashIntegrity
      }
    });

    await logWebhookService.send({
      type: "critical_audit_event",
      id: record.id,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      requestId: record.requestId,
      timestamp: record.timestamp.toISOString()
    });
  }
}

export const auditService = new AuditService();
