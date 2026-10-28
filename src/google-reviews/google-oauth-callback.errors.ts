import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

export type GoogleOAuthCallbackErrorCode =
  | 'connect_failed'
  | 'encryption'
  | 'state'
  | 'refresh_token'
  | 'token_exchange'
  | 'server';

const USER_MESSAGES: Record<GoogleOAuthCallbackErrorCode, string> = {
  connect_failed:
    'Google connection was cancelled or interrupted. Try again.',
  encryption:
    'The server cannot store Google credentials securely yet. Your administrator must set GOOGLE_TOKEN_ENCRYPTION_KEY on the API and restart it.',
  state:
    'This connection link expired or was already used. Click Connect Google Business again (finish within a few minutes).',
  refresh_token:
    'Google did not grant offline access. Open https://myaccount.google.com/permissions, remove access for this app, then connect again and accept all permissions.',
  token_exchange:
    'Sign-in could not be completed. Your administrator should verify GOOGLE_OAUTH_REDIRECT_URI matches Google Cloud exactly, then try again.',
  server:
    'Google connection failed on the server. Try again in a moment or contact support.',
};

export function messageForOAuthCallbackError(
  code: string | null | undefined,
): string {
  if (!code) return USER_MESSAGES.connect_failed;
  if (code in USER_MESSAGES) {
    return USER_MESSAGES[code as GoogleOAuthCallbackErrorCode];
  }
  return USER_MESSAGES.connect_failed;
}

export function classifyOAuthCallbackError(error: unknown): GoogleOAuthCallbackErrorCode {
  if (error instanceof BadRequestException) {
    const response = error.getResponse();
    const message =
      typeof response === 'string'
        ? response
        : typeof response === 'object' &&
            response &&
            'message' in response &&
            typeof (response as { message: unknown }).message === 'string'
          ? (response as { message: string }).message
          : error.message;

    const lower = message.toLowerCase();
    if (lower.includes('refresh token')) return 'refresh_token';
    if (lower.includes('oauth state') || lower.includes('invalid or expired oauth state')) {
      return 'state';
    }
    if (
      lower.includes('oauth code exchange') ||
      lower.includes('invalid_grant') ||
      lower.includes('redirect_uri_mismatch')
    ) {
      return 'token_exchange';
    }
    if (lower.includes('not fully configured')) return 'encryption';
  }

  if (error instanceof InternalServerErrorException) {
    const response = error.getResponse();
    const message =
      typeof response === 'string' ? response : error.message;
    if (message.toLowerCase().includes('encryption')) return 'encryption';
  }

  return 'server';
}
