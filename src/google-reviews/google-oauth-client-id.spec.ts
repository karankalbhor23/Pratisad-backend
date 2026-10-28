import {
  isValidGoogleOAuthClientId,
  maskGoogleOAuthClientId,
} from './google-oauth.service';

describe('Google OAuth client ID helpers', () => {
  it('accepts a standard web client id', () => {
    const id = '123456789012-abcdef.apps.googleusercontent.com';
    expect(isValidGoogleOAuthClientId(id)).toBe(true);
    expect(maskGoogleOAuthClientId(id)).toContain('apps.googleusercontent.com');
  });

  it('rejects secrets and empty values', () => {
    expect(isValidGoogleOAuthClientId('GOCSPX-not-a-client-id')).toBe(false);
    expect(isValidGoogleOAuthClientId('')).toBe(false);
  });
});
