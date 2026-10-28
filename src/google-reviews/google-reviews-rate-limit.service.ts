import { Injectable } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';

const MANUAL_SYNC_COOLDOWN_MS = 15 * 60 * 1000;
const OAUTH_START_COOLDOWN_MS = 60 * 60 * 1000;
const OAUTH_START_MAX = 10;

@Injectable()
export class GoogleReviewsRateLimitService {
  private readonly manualSync = new Map<string, number>();
  private readonly oauthStarts = new Map<string, number[]>();

  assertManualSyncAllowed(businessId: string): void {
    const last = this.manualSync.get(businessId);
    if (last && Date.now() - last < MANUAL_SYNC_COOLDOWN_MS) {
      throw new HttpException(
        'Please wait before syncing again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.manualSync.set(businessId, Date.now());
  }

  assertOAuthStartAllowed(businessId: string): void {
    const now = Date.now();
    const recent = (this.oauthStarts.get(businessId) ?? []).filter(
      (t) => now - t < OAUTH_START_COOLDOWN_MS,
    );
    if (recent.length >= OAUTH_START_MAX) {
      throw new HttpException(
        'Too many connect attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.oauthStarts.set(businessId, recent);
  }
}
