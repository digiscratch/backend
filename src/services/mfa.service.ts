import { generateSecret, generateURI, verifySync } from "otplib";
import { MFA_ISSUER } from "../config/constants";
import { encryptionService } from "./encryption.service";

export class MfaService {
  generateSetup(email: string) {
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: MFA_ISSUER,
      label: email,
      secret,
      period: 30
    });
    const encryptedSecret = encryptionService.encrypt(secret);

    return {
      secret,
      otpauthUrl,
      encryptedSecret
    };
  }

  verifyToken(secret: string, token: string): boolean {
    return verifySync({
      secret,
      token,
      period: 30,
      epochTolerance: 30
    }).valid;
  }
}

export const mfaService = new MfaService();
