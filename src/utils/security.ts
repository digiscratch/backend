import { createHash, createHmac, randomBytes } from "crypto";
import { GENERIC_USER_PATTERNS } from "../config/constants";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function randomToken(size = 32): string {
  return randomBytes(size).toString("hex");
}

export function normalizeDocument(document: string): string {
  return document.replace(/\D+/g, "").trim();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isGenericIdentity(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return GENERIC_USER_PATTERNS.some((pattern) => normalized.includes(pattern));
}
