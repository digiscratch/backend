import { z } from "zod";

export const standSearchSchema = z.object({
  document: z.string().min(5).max(30),
  eventCode: z.string().min(3).max(100).optional()
});

export const redeemSchema = z.object({
  participationId: z.string().uuid()
});
