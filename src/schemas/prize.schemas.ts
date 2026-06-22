import { z } from "zod";

export const prizeSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().min(2).max(255),
  description: z.string().max(5000).optional(),
  stockTotal: z.number().int().nonnegative(),
  stockAvailable: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional()
});

export const prizePatchSchema = prizeSchema.partial().omit({ eventId: true });

export const prizeInventorySchema = z.object({
  stockAvailable: z.number().int().nonnegative()
});
