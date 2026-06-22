import type { Prisma } from "@prisma/client";
import { encryptionService } from "./encryption.service";
import { documentHashService } from "./hash.service";

export interface ParticipantInput {
  document: string;
  name: string;
  phone: string;
  email: string;
}

export interface DecryptedParticipant {
  document: string;
  name: string;
  phone: string;
  email: string;
}

export class ParticipantService {
  createParticipantData(input: ParticipantInput): {
    documentHash: string;
    participantData: Prisma.ParticipantUncheckedCreateInput;
  } {
    const documentHash = documentHashService.hashDocument(input.document);
    const documentEncrypted = encryptionService.encrypt(input.document);
    const nameEncrypted = encryptionService.encrypt(input.name);
    const phoneEncrypted = encryptionService.encrypt(input.phone);
    const emailEncrypted = encryptionService.encrypt(input.email.trim().toLowerCase());

    return {
      documentHash,
      participantData: {
        documentHash,
        documentCiphertext: documentEncrypted.ciphertext,
        documentIv: documentEncrypted.iv,
        documentAuthTag: documentEncrypted.authTag,
        nameCiphertext: nameEncrypted.ciphertext,
        nameIv: nameEncrypted.iv,
        nameAuthTag: nameEncrypted.authTag,
        phoneCiphertext: phoneEncrypted.ciphertext,
        phoneIv: phoneEncrypted.iv,
        phoneAuthTag: phoneEncrypted.authTag,
        emailCiphertext: emailEncrypted.ciphertext,
        emailIv: emailEncrypted.iv,
        emailAuthTag: emailEncrypted.authTag
      }
    };
  }

  decryptParticipant(participant: {
    documentCiphertext: string;
    documentIv: string;
    documentAuthTag: string;
    nameCiphertext: string;
    nameIv: string;
    nameAuthTag: string;
    phoneCiphertext: string;
    phoneIv: string;
    phoneAuthTag: string;
    emailCiphertext: string;
    emailIv: string;
    emailAuthTag: string;
  }): DecryptedParticipant {
    return {
      document: encryptionService.decrypt({
        ciphertext: participant.documentCiphertext,
        iv: participant.documentIv,
        authTag: participant.documentAuthTag
      }),
      name: encryptionService.decrypt({
        ciphertext: participant.nameCiphertext,
        iv: participant.nameIv,
        authTag: participant.nameAuthTag
      }),
      phone: encryptionService.decrypt({
        ciphertext: participant.phoneCiphertext,
        iv: participant.phoneIv,
        authTag: participant.phoneAuthTag
      }),
      email: encryptionService.decrypt({
        ciphertext: participant.emailCiphertext,
        iv: participant.emailIv,
        authTag: participant.emailAuthTag
      })
    };
  }
}

export const participantService = new ParticipantService();
