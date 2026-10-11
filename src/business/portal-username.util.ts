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
}
