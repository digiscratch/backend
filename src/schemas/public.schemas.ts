import { z } from "zod";

export const participateSchema = z.object({
  document: z.string().min(5).max(30),
  name: z.string().min(3).max(255),
  phone: z.string().min(7).max(30),
  email: z.string().email()
});

export const publicResultQuerySchema = z.object({
  document: z.string().min(5).max(30)
});
