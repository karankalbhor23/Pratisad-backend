import {
  extractClerkUserId,
  extractUsernameFromClerkPayload,
} from './clerk-token.util';

describe('clerk-token.util', () => {
  it('extracts clerk user id from sub', () => {
    expect(extractClerkUserId({ sub: 'user_abc' })).toBe('user_abc');
  });

  it('extracts username from custom session claim', () => {
    expect(
      extractUsernameFromClerkPayload({ username: 'Salon.Owner' }),
    ).toBe('salon.owner');
  });
});
