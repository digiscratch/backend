import argon2, { argon2id } from "argon2";
import { HttpError } from "../lib/http-error";

export class PasswordService {
  validatePolicy(password: string): void {
    const hasLength = password.length > 6;
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasLength || !hasNumber || !hasSpecial) {
      throw new HttpError(
        400,
        "PASSWORD_POLICY_VIOLATION",
        "Password must be longer than 6 characters and include a number and a special character."
      );
    }
  }

  async hash(password: string): Promise<string> {
    this.validatePolicy(password);
    return argon2.hash(password, {
      type: argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1
    });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}

export const passwordService = new PasswordService();
