import { env } from "../config/env";
import { hmacSha256, normalizeDocument } from "../utils/security";

export class DocumentHashService {
  hashDocument(document: string): string {
    return hmacSha256(normalizeDocument(document), env.DOCUMENT_HASH_SECRET);
  }

  normalize(document: string): string {
    return normalizeDocument(document);
  }
}

export const documentHashService = new DocumentHashService();
