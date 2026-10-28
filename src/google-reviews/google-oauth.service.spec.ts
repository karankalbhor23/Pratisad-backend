import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleOAuthService } from './google-oauth.service';

describe('GoogleOAuthService state', () => {
  const config = {
    get: (key: string) => {
      if (key === 'GOOGLE_OAUTH_STATE_SECRET') return 'state-secret';
      if (key === 'GOOGLE_OAUTH_CLIENT_ID')
        return '123456789012-abcdef.apps.googleusercontent.com';
      if (key === 'GOOGLE_OAUTH_CLIENT_SECRET') return 'client-secret';
      if (key === 'PORT') return '4000';
      return undefined;
    },
  } as ConfigService;

  const prisma = {} as never;

  it('signs and verifies state', () => {
    const service = new GoogleOAuthService(config, prisma);
    const exp = Date.now() + 60_000;
    const state = service.signState({
      nonce: 'abc123',
      businessId: 'biz-1',
      clerkUserId: 'user-1',
      exp,
    });
    const parsed = service.verifyState(state);
    expect(parsed.nonce).toBe('abc123');
    expect(parsed.businessId).toBe('biz-1');
  });

  it('rejects tampered state', () => {
    const service = new GoogleOAuthService(config, prisma);
    const state = service.signState({
      nonce: 'abc123',
      businessId: 'biz-1',
      clerkUserId: 'user-1',
      exp: Date.now() + 60_000,
    });
    expect(() => service.verifyState(`${state}x`)).toThrow(BadRequestException);
  });
});
