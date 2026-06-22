import type { Request } from "express";

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0]?.trim() ?? request.ip ?? "unknown";
  }

  return request.ip ?? "unknown";
}
