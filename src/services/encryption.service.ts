import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "../config/env";

export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export class EncryptionService {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = Buffer.from(secret, "utf8").subarray(0, 32);

    if (this.key.length !== 32) {
      throw new Error("PII_ENCRYPTION_KEY must provide at least 32 bytes.");
    }
  }

  encrypt(plainText: string): EncryptedValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64")
    };
  }

  decrypt(payload: EncryptedValue): string {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(payload.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final()
    ]);

    return decrypted.toString("utf8");
  }
}

export const encryptionService = new EncryptionService(env.PII_ENCRYPTION_KEY);
