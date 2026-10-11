import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import { ClerkAuthedRequest } from './authed-request.types';
import {
  extractClerkUserId,
  extractEmailFromClerkPayload,
} from './clerk-token.util';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const bypass =
      this.config.get<string>('E2E_AUTH_BYPASS') === 'true' &&
      this.config.get<string>('NODE_ENV') !== 'production';
    const request = context.switchToHttp().getRequest<ClerkAuthedRequest>();

    if (bypass) {
      request.clerkEmail =
        this.config.get<string>('E2E_CLERK_EMAIL') ?? 'e2e@test.com';
      request.clerkUserId =
        this.config.get<string>('E2E_CLERK_USER_ID') ?? 'e2e-user-id';
      return true;
    }

    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer '))
      throw new UnauthorizedException('Authentication required');

    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    if (!secretKey)
      throw new UnauthorizedException('Authentication is not configured');

    try {
      const payload = await verifyToken(header.slice(7), { secretKey });
      const email = extractEmailFromClerkPayload(payload);
      const clerkUserId = extractClerkUserId(payload);
      if (!email) throw new UnauthorizedException('Email claim missing from token');
      request.clerkEmail = email;
      request.clerkUserId = clerkUserId;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
