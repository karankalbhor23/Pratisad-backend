import { BadRequestException } from '@nestjs/common';

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizePortalUsername(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(normalized)) {
    throw new BadRequestException(
      'Portal username must be 3–32 characters: lowercase letters, numbers, dots, underscores, or hyphens.',
    );
  }
  return normalized;
}

export function assertPortalPassword(password: string): void {
  if (!password || password.length < 8) {
    throw new BadRequestException(
      'Portal password must be at least 8 characters.',
    );
  }
  if (password.length > 128) {
    throw new BadRequestException(
      'Portal password must be at most 128 characters.',
    );
  }
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  if (!(hasLower && hasUpper && hasDigit && hasSymbol)) {
    throw new BadRequestException(
      'Portal password must include uppercase, lowercase, a number, and a symbol.',
    );
  }
}
