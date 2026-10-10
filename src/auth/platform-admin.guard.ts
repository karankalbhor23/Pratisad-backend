import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

type AuthedRequest = Request & { platformAdminEmail?: string };

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const bypass =
      this.config.get<string>('E2E_AUTH_BYPASS') === 'true' &&
      this.config.get<string>('NODE_ENV') !== 'production';
    if (bypass) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer '))
      throw new UnauthorizedException('Authentication required');

    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    if (!secretKey)
      throw new UnauthorizedException('Authentication is not configured');

    let email: string | undefined;
    try {
      const payload = await verifyToken(header.slice(7), { secretKey });
      email = this.extractEmail(payload);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!email) throw new UnauthorizedException('Email claim missing from token');

    const admin = await this.prisma.platformAdmin.findFirst({
      where: { email: email.toLowerCase(), isActive: true },
    });
    if (!admin)
      throw new ForbiddenException('Platform admin access required');

    request.platformAdminEmail = admin.email;
    return true;
  }

  private extractEmail(payload: Record<string, unknown>): string | undefined {
    const direct = payload.email;
    if (typeof direct === 'string' && direct) return direct.toLowerCase();

    const primary = payload.primary_email_address;
    if (typeof primary === 'string' && primary)
      return primary.toLowerCase();

    return undefined;
  }
}
