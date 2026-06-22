-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InternalUserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'STAND_OPERATOR', 'AUDITOR');

-- CreateEnum
CREATE TYPE "ParticipationResult" AS ENUM ('WINNER', 'NO_PRIZE');

-- CreateTable
CREATE TABLE "internal_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" "InternalUserRole" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "internal_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "secret_ciphertext" TEXT NOT NULL,
    "secret_iv" TEXT NOT NULL,
    "secret_auth_tag" TEXT NOT NULL,
    "otpauth_url" TEXT NOT NULL,
    "enrolled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mfa_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_ip" VARCHAR(128),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prizes" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "stock_total" INTEGER NOT NULL,
    "stock_available" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "prizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" UUID NOT NULL,
    "document_hash" VARCHAR(64) NOT NULL,
    "document_ciphertext" TEXT NOT NULL,
    "document_iv" TEXT NOT NULL,
    "document_auth_tag" TEXT NOT NULL,
    "name_ciphertext" TEXT NOT NULL,
    "name_iv" TEXT NOT NULL,
    "name_auth_tag" TEXT NOT NULL,
    "phone_ciphertext" TEXT NOT NULL,
    "phone_iv" TEXT NOT NULL,
    "phone_auth_tag" TEXT NOT NULL,
    "email_ciphertext" TEXT NOT NULL,
    "email_iv" TEXT NOT NULL,
    "email_auth_tag" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participations" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "document_hash" VARCHAR(64) NOT NULL,
    "prize_id" UUID,
    "result" "ParticipationResult" NOT NULL,
    "result_message" TEXT,
    "redeemed" BOOLEAN NOT NULL DEFAULT false,
    "redeemed_at" TIMESTAMPTZ(6),
    "redeemed_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "actor_email" VARCHAR(255),
    "actor_role" "InternalUserRole",
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "ip_address" VARCHAR(128),
    "user_agent" TEXT,
    "request_id" VARCHAR(100),
    "previous_value" JSONB,
    "new_value" JSONB,
    "metadata" JSONB,
    "hash_integrity" VARCHAR(64) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_users_email_key" ON "internal_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_settings_user_id_key" ON "mfa_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_code_key" ON "events"("code");

-- CreateIndex
CREATE INDEX "prizes_event_id_idx" ON "prizes"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "participants_document_hash_key" ON "participants"("document_hash");

-- CreateIndex
CREATE INDEX "participations_participant_id_idx" ON "participations"("participant_id");

-- CreateIndex
CREATE INDEX "participations_event_id_idx" ON "participations"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "participations_event_id_document_hash_key" ON "participations"("event_id", "document_hash");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "mfa_settings" ADD CONSTRAINT "mfa_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "internal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "internal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prizes" ADD CONSTRAINT "prizes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_prize_id_fkey" FOREIGN KEY ("prize_id") REFERENCES "prizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_redeemed_by_user_id_fkey" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "internal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "internal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

