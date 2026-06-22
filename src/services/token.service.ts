import jwt from "jsonwebtoken";
import { InternalUserRole } from "@prisma/client";
import { env } from "../config/env";
import { randomToken, sha256 } from "../utils/security";

export interface AuthClaims {
  sub: string;
  email: string;
  role: InternalUserRole;
  mfaEnabled: boolean;
  tokenId: string;
}

export interface ChallengeClaims {
  sub: string;
  email: string;
  role: InternalUserRole;
  purpose: "mfa_setup" | "mfa_verify";
}

export class TokenService {
  createAccessToken(claims: AuthClaims): string {
    return jwt.sign(claims, env.JWT_SECRET, {
      expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`
    });
  }

  verifyAccessToken(token: string): AuthClaims {
    return jwt.verify(token, env.JWT_SECRET) as AuthClaims;
  }

  createChallengeToken(claims: ChallengeClaims): string {
    return jwt.sign(claims, env.JWT_SECRET, { expiresIn: "10m" });
  }

  verifyChallengeToken(token: string): ChallengeClaims {
    return jwt.verify(token, env.JWT_SECRET) as ChallengeClaims;
  }

  createRefreshToken(): { plain: string; hash: string } {
    const plain = randomToken(48);
    return { plain, hash: sha256(plain) };
  }

  hashRefreshToken(token: string): string {
    return sha256(token);
  }

  createRefreshJwt(payload: { sub: string; tokenHash: string }): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`
    });
  }

  verifyRefreshJwt(token: string): { sub: string; tokenHash: string } {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as {
      sub: string;
      tokenHash: string;
    };
  }
}

export const tokenService = new TokenService();
