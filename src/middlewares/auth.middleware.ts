import type { InternalUserRole } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error";
import { tokenService } from "../services/token.service";

function readBearerToken(request: Request): string {
  const authorization = request.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "UNAUTHORIZED", "Missing bearer token.");
  }

  return authorization.slice("Bearer ".length).trim();
}

export function requireAuth(request: Request, _response: Response, next: NextFunction): void {
  try {
    const token = readBearerToken(request);
    const claims = tokenService.verifyAccessToken(token);

    request.auth = {
      userId: claims.sub,
      email: claims.email,
      role: claims.role,
      mfaEnabled: claims.mfaEnabled,
      tokenId: claims.tokenId
    };

    next();
  } catch {
    next(new HttpError(401, "UNAUTHORIZED", "Invalid or expired token."));
  }
}

export function requireRoles(roles: InternalUserRole[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.auth) {
      next(new HttpError(401, "UNAUTHORIZED", "Authentication required."));
      return;
    }

    if (!request.auth.mfaEnabled) {
      next(new HttpError(403, "MFA_REQUIRED", "MFA must be enabled before using internal endpoints."));
      return;
    }

    if (!roles.includes(request.auth.role)) {
      next(new HttpError(403, "FORBIDDEN", "Insufficient permissions."));
      return;
    }

    next();
  };
}
