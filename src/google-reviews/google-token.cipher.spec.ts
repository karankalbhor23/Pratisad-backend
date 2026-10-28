import { ConfigService } from '@nestjs/config';
import { GoogleTokenCipher } from './google-token.cipher';

describe('GoogleTokenCipher', () => {
  const config = {
    get: (key: string) =>
      key === 'GOOGLE_TOKEN_ENCRYPTION_KEY' ? 'test-secret-key-for-unit-tests' : undefined,
  } as ConfigService;

  it('round-trips encrypt and decrypt', () => {
    const cipher = new GoogleTokenCipher(config);
    expect(cipher.isConfigured()).toBe(true);
    const plain = 'refresh-token-value-12345';
    const encrypted = cipher.encrypt(plain);
    expect(encrypted).not.toContain(plain);
    expect(cipher.decrypt(encrypted)).toBe(plain);
  });

  it('reports not configured without key', () => {
    const empty = { get: () => undefined } as ConfigService;
    const cipher = new GoogleTokenCipher(empty);
    expect(cipher.isConfigured()).toBe(false);
  });
});
