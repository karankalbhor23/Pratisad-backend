import { randomBytes } from 'crypto';

const TOKEN_LENGTH = 10;
const TOKEN_PATTERN = /^[a-z0-9]{8,12}$/;

export function isValidReviewCardToken(raw: string): boolean {
  return TOKEN_PATTERN.test(raw.trim().toLowerCase());
}

export function normalizeReviewCardToken(raw: string): string {
  return raw.trim().toLowerCase();
}

export function generateReviewCardToken(): string {
  return randomBytes(8)
    .toString('base64url')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, TOKEN_LENGTH)
    .padEnd(TOKEN_LENGTH, '0');
}
