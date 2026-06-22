import { InternalUserRole } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware";

export const auditRouter = Router();

auditRouter.use(requireAuth, requireRoles([InternalUserRole.SUPER_ADMIN, InternalUserRole.AUDITOR]));

auditRouter.get("/", async (_request, response, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 200
    });
    response.json(logs);
  } catch (error) {
    next(error);
  }
});
