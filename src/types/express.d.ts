import type { InternalUserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: {
        userId: string;
        email: string;
        role: InternalUserRole;
        mfaEnabled: boolean;
        tokenId?: string;
      };
    }
  }
}

export {};
