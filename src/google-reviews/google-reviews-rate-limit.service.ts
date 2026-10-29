import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_MANUAL_SYNC_COOLDOWN_MS = 15 * 60 * 1000;
const OAUTH_START_COOLDOWN_MS = 60 * 60 * 1000;
const OAUTH_START_MAX = 10;

@Injectable()
export class GoogleReviewsRateLimitService {
  private readonly manualSync = new Map<string, number>();
  private readonly oauthStarts = new Map<string, number[]>();

  constructor(private readonly config: ConfigService) {}

  /** 0 = no cooldown (testing). Unset env defaults to 0; set 900000 for 15 min in production. */
  private manualSyncCooldownMs(): number {
    const raw = this.config.get<string>('GOOGLE_REVIEWS_MANUAL_SYNC_COOLDOWN_MS');
    if (raw === undefined || raw.trim() === '') {
      return 0;
    }
    const n = Number(raw.trim());
    if (!Number.isFinite(n) || n < 0) {
      return DEFAULT_MANUAL_SYNC_COOLDOWN_MS;
    }
    return n;
  }

  assertManualSyncAllowed(businessId: string): void {
    const cooldown = this.manualSyncCooldownMs();
    if (cooldown === 0) {
      return;
    }
    const last = this.manualSync.get(businessId);
    if (last && Date.now() - last < cooldown) {
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
