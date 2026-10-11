import { BadRequestException } from '@nestjs/common';
import {
  assertPortalPassword,
  normalizePortalUsername,
} from './portal-username.util';

describe('portal-username.util', () => {
  it('normalizes valid usernames', () => {
    expect(normalizePortalUsername('Bavdhan.Salon')).toBe('bavdhan.salon');
  });

  it('rejects invalid usernames', () => {
    expect(() => normalizePortalUsername('ab')).toThrow(BadRequestException);
  });

  it('requires password length', () => {
    expect(() => assertPortalPassword('short')).toThrow(BadRequestException);
  });
});
