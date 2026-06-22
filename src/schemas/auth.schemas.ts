import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const mfaVerifySchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/)
});

export const mfaSetupSchema = z.object({
  challengeToken: z.string().min(1)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});
