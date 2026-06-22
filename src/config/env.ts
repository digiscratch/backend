import { config } from "dotenv";
import { z } from "zod";

config();

const defaultAllowedOrigins = [
  "http://localhost:4200",
  "https://digiscratch.github.io"
];

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PII_ENCRYPTION_KEY: z.string().min(32),
  DOCUMENT_HASH_SECRET: z.string().min(32),
  ALLOWED_ORIGINS: z.string().default(defaultAllowedOrigins.join(",")),
  LOG_WEBHOOK_URL: optionalUrl,
  REDIS_URL: optionalUrl,
  APP_VERSION: z.string().default("1.0.0"),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  GLOBAL_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  GLOBAL_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
  PARTICIPATION_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
  PARTICIPATION_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(10),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_NAME: z.string().min(3).optional(),
  SEED_ADMIN_PASSWORD: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
  allowedOrigins: Array.from(
    new Set(
      [...defaultAllowedOrigins, ...parsed.data.ALLOWED_ORIGINS.split(",")]
        .map((origin) => origin.trim())
        .filter(Boolean)
    )
  )
};
