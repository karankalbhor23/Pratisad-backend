import { ClerkAPIResponseError } from '@clerk/backend/errors';
import { formatClerkError } from './clerk-error.util';

describe('formatClerkError', () => {
  it('maps known Clerk password breach codes to a clear message', () => {
    const error = new ClerkAPIResponseError('Unprocessable Entity', {
      status: 422,
      data: [
        {
          code: 'form_password_pwned',
          message: 'Password has been found in an online data breach.',
          long_message:
            'This password has been found in an online data breach. Please choose a different password.',
        },
      ],
    });

    expect(formatClerkError(error)).toContain('data breach');
  });

  it('falls back to Clerk long messages for unknown codes', () => {
    const error = new ClerkAPIResponseError('Unprocessable Entity', {
      status: 422,
      data: [
        {
          code: 'some_new_code',
          message: 'Short message',
          long_message: 'Detailed Clerk validation message.',
        },
      ],
    });

    expect(formatClerkError(error)).toBe('Detailed Clerk validation message.');
  });
});
