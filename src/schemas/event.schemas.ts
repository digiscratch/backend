import { z } from "zod";

export const eventSchema = z.object({
  code: z.string().min(3).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().min(3).max(255),
  description: z.string().max(5000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  isActive: z.boolean().optional()
});

export const eventPatchSchema = eventSchema.partial();
