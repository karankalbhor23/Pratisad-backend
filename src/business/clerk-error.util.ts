import { isClerkAPIResponseError } from '@clerk/backend/errors';

const FRIENDLY_CLERK_ERROR_CODES: Record<string, string> = {
  form_username_exists: 'This portal username is already taken in Clerk.',
  form_identifier_exists: 'This portal username is already taken in Clerk.',
  form_password_pwned:
    'This password was found in a data breach. Choose a different, unique password.',
  form_password_length_too_short: 'Password is too short for Clerk.',
  form_password_not_strong_enough:
    'Password is not strong enough. Use uppercase, lowercase, a number, and a symbol.',
  form_password_validation_failed: 'Password does not meet Clerk security rules.',
  form_username_invalid_character:
    'Username contains characters Clerk does not allow.',
  form_username_invalid_length: 'Username length is invalid for Clerk.',
  form_param_format_invalid: 'Portal username or password format is invalid.',
};

export function formatClerkError(error: unknown): string {
  if (isClerkAPIResponseError(error)) {
    const parts = error.errors
      .map((entry) => {
        const friendly = FRIENDLY_CLERK_ERROR_CODES[entry.code];
        if (friendly) return friendly;
        return entry.longMessage?.trim() || entry.message?.trim();
      })
      .filter((message): message is string => Boolean(message));

    if (parts.length > 0) {
      return parts.join(' ');
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return 'Could not complete the Clerk request. Check username and password rules.';
}
