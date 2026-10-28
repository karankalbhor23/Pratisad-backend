import { BadRequestException } from '@nestjs/common';
import { classifyOAuthCallbackError } from './google-oauth-callback.errors';

describe('classifyOAuthCallbackError', () => {
  it('classifies refresh token errors', () => {
    const err = new BadRequestException(
      'Google did not return a refresh token. Disconnect the app in your Google account and try again with consent.',
    );
    expect(classifyOAuthCallbackError(err)).toBe('refresh_token');
  });

  it('classifies token exchange errors', () => {
    const err = new BadRequestException('invalid_grant: Bad Request');
    expect(classifyOAuthCallbackError(err)).toBe('token_exchange');
  });
});
