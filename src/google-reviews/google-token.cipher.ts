import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

@Injectable()
export class GoogleTokenCipher {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY');
    if (!raw?.trim()) {
      this.key = Buffer.alloc(0);
    } else {
      this.key = createHash('sha256').update(raw.trim()).digest();
    }
  }

  isConfigured(): boolean {
    return this.key.length === 32;
  }

  encrypt(plaintext: string): string {
    this.assertConfigured();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64url');
  }

  decrypt(payload: string): string {
    this.assertConfigured();
    const buffer = Buffer.from(payload, 'base64url');
    if (buffer.length < IV_LENGTH + TAG_LENGTH + 1) {
      throw new InternalServerErrorException('Invalid encrypted token payload');
    }
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new InternalServerErrorException(
        'Google token encryption is not configured',
      );
    }
  }
}
