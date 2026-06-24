import { InternalUserRole } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { normalizeEmail, isGenericIdentity } from "../utils/security";
import { passwordService } from "./password.service";
import { tokenService } from "./token.service";
import { mfaService } from "./mfa.service";
import { auditService } from "./audit.service";
import { encryptionService } from "./encryption.service";
import { env } from "../config/env";

export class AuthService {
  async login(email: string, password: string, request: Request) {
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.internalUser.findUnique({
      where: { email: normalizedEmail },
      include: { mfaSettings: true }
    });

    if (!user || !user.isActive || !(await passwordService.verify(user.passwordHash, password))) {
      await auditService.log({
        action: "LOGIN_FAILED",
        entityType: "internal_user",
        entityId: normalizedEmail,
        actorEmail: normalizedEmail,
        metadata: { reason: "invalid_credentials" },
        request
      });
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials.");
    }

    await auditService.log({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "LOGIN_SUCCESS",
      entityType: "internal_user",
      entityId: user.id,
      metadata: { stage: user.mfaEnabled ? "password_verified" : "mfa_setup_required" },
      request
    });

    return {
      requiresMfa: true,
      mfaEnabled: user.mfaEnabled,
      challengeToken: tokenService.createChallengeToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        purpose: user.mfaEnabled ? "mfa_verify" : "mfa_setup"
      })
    };
  }

  async setupMfa(challengeToken: string, request: Request) {
    const claims = tokenService.verifyChallengeToken(challengeToken);

    if (claims.purpose !== "mfa_setup") {
      throw new HttpError(403, "INVALID_CHALLENGE", "Challenge token is not valid for MFA setup.");
    }

    const setup = mfaService.generateSetup(claims.email);

    await prisma.mfaSetting.upsert({
      where: { userId: claims.sub },
      update: {
        secretCiphertext: setup.encryptedSecret.ciphertext,
        secretIv: setup.encryptedSecret.iv,
        secretAuthTag: setup.encryptedSecret.authTag,
        otpauthUrl: setup.otpauthUrl
      },
      create: {
        userId: claims.sub,
        secretCiphertext: setup.encryptedSecret.ciphertext,
        secretIv: setup.encryptedSecret.iv,
        secretAuthTag: setup.encryptedSecret.authTag,
        otpauthUrl: setup.otpauthUrl
      }
    });

    await auditService.log({
      actorUserId: claims.sub,
      actorEmail: claims.email,
      actorRole: claims.role,
      action: "MFA_ENROLLMENT_STARTED",
      entityType: "mfa_settings",
      entityId: claims.sub,
      request
    });

    return {
      otpauthUrl: setup.otpauthUrl,
      secret: setup.secret
    };
  }

  async enableMfa(challengeToken: string, code: string, request: Request) {
    const claims = tokenService.verifyChallengeToken(challengeToken);

    if (claims.purpose !== "mfa_setup") {
      throw new HttpError(403, "INVALID_CHALLENGE", "Challenge token is not valid for MFA setup.");
    }

    const mfaSettings = await prisma.mfaSetting.findUnique({ where: { userId: claims.sub } });

    if (!mfaSettings) {
      throw new HttpError(400, "MFA_SETUP_REQUIRED", "MFA setup must be completed first.");
    }

    const secret = this.readMfaSecret(
      mfaSettings.secretCiphertext,
      mfaSettings.secretIv,
      mfaSettings.secretAuthTag
    );

    if (!mfaService.verifyToken(secret, code)) {
      throw new HttpError(401, "INVALID_MFA_CODE", "Invalid MFA code.");
    }

    await prisma.internalUser.update({
      where: { id: claims.sub },
      data: { mfaEnabled: true }
    });

    await prisma.mfaSetting.update({
      where: { userId: claims.sub },
      data: { enrolledAt: new Date() }
    });

    await auditService.log({
      actorUserId: claims.sub,
      actorEmail: claims.email,
      actorRole: claims.role,
      action: "MFA_ENROLLED",
      entityType: "mfa_settings",
      entityId: claims.sub,
      request
    });

    const user = await prisma.internalUser.findUniqueOrThrow({ where: { id: claims.sub } });
    return this.issueSession(user.id, user.email, user.role, request);
  }

  async verifyMfa(challengeToken: string, code: string, request: Request) {
    const claims = tokenService.verifyChallengeToken(challengeToken);

    if (claims.purpose !== "mfa_verify") {
      throw new HttpError(403, "INVALID_CHALLENGE", "Challenge token is not valid for MFA verification.");
    }

    const user = await prisma.internalUser.findUnique({
      where: { id: claims.sub },
      include: { mfaSettings: true }
    });

    if (!user?.mfaEnabled || !user.mfaSettings) {
      throw new HttpError(403, "MFA_REQUIRED", "MFA must be configured first.");
    }

    const secret = this.readMfaSecret(
      user.mfaSettings.secretCiphertext,
      user.mfaSettings.secretIv,
      user.mfaSettings.secretAuthTag
    );

    if (!mfaService.verifyToken(secret, code)) {
      throw new HttpError(401, "INVALID_MFA_CODE", "Invalid MFA code.");
    }

    return this.issueSession(user.id, user.email, user.role, request);
  }

  async refresh(refreshTokenJwt: string, request: Request) {
    const payload = tokenService.verifyRefreshJwt(refreshTokenJwt);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: payload.tokenHash },
      include: { user: true }
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid.");
    }

    return this.issueSession(storedToken.user.id, storedToken.user.email, storedToken.user.role, request, storedToken.id);
  }

  async logout(refreshTokenJwt: string): Promise<void> {
    const payload = tokenService.verifyRefreshJwt(refreshTokenJwt);
    await prisma.refreshToken.updateMany({
      where: { tokenHash: payload.tokenHash, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  async getMe(userId: string) {
    const user = await prisma.internalUser.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mfaEnabled: true,
        isActive: true,
        createdAt: true
      }
    });

    return user;
  }

  async seedSuperAdmin(name: string, email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);

    if (isGenericIdentity(normalizedEmail) || isGenericIdentity(name)) {
      throw new HttpError(400, "GENERIC_IDENTITY_FORBIDDEN", "Seed admin must be nominative and non-generic.");
    }

    const passwordHash = await passwordService.hash(password);

    return prisma.internalUser.upsert({
      where: { email: normalizedEmail },
      update: {
        name,
        passwordHash,
        role: InternalUserRole.SUPER_ADMIN,
        isActive: true,
        mfaEnabled: false
      },
      create: {
        email: normalizedEmail,
        name,
        passwordHash,
        role: InternalUserRole.SUPER_ADMIN,
        isActive: true,
        mfaEnabled: false
      }
    });
  }

  private async issueSession(
    userId: string,
    email: string,
    role: InternalUserRole,
    request: Request,
    currentTokenId?: string
  ) {
    if (currentTokenId) {
      await prisma.refreshToken.update({
        where: { id: currentTokenId },
        data: { revokedAt: new Date() }
      });
    }

    const refreshToken = tokenService.createRefreshToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * env.REFRESH_TOKEN_TTL_DAYS);
    const persisted = await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshToken.hash,
        expiresAt,
        createdByIp: request.ip ?? null
      }
    });

    const accessToken = tokenService.createAccessToken({
      sub: userId,
      email,
      role,
      mfaEnabled: true,
      tokenId: persisted.id
    });

    const refreshTokenJwt = tokenService.createRefreshJwt({
      sub: userId,
      tokenHash: refreshToken.hash
    });

    return {
      accessToken,
      refreshToken: refreshTokenJwt,
      expiresInMinutes: env.ACCESS_TOKEN_TTL_MINUTES
    };
  }

  private readMfaSecret(ciphertext: string, iv: string, authTag: string): string {
    try {
      return encryptionService.decrypt({ ciphertext, iv, authTag });
    } catch {
      throw new HttpError(
        409,
        "MFA_RESET_REQUIRED",
        "La verificación de seguridad debe configurarse nuevamente."
      );
    }
  }
}

export const authService = new AuthService();
