import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

@Injectable()
export class ReviewDraftThrottleGuard implements CanActivate {
  private readonly requests = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    const now = Date.now();
    for (const [ip, timestamps] of this.requests) {
      const active = timestamps.filter((time) => now - time < WINDOW_MS);
      if (active.length) this.requests.set(ip, active);
      else this.requests.delete(ip);
    }
    const recent = this.requests.get(key) ?? [];
    if (recent.length >= MAX_REQUESTS) {
      throw new HttpException(
        'Too many draft requests. Please try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.requests.set(key, recent);
    return true;
  }
}
