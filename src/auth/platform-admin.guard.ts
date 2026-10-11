import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkAuthedRequest } from './authed-request.types';
import { ClerkAuthGuard } from './clerk-auth.guard';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    private readonly clerkAuth: ClerkAuthGuard,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const clerkOk = await this.clerkAuth.canActivate(context);
    if (!clerkOk) return false;

    const request = context.switchToHttp().getRequest<ClerkAuthedRequest>();
    const email = request.clerkEmail;
    if (!email) throw new ForbiddenException('Platform admin access required');

    const admin = await this.prisma.platformAdmin.findFirst({
      where: { email: email.toLowerCase(), isActive: true },
    });
    if (!admin) throw new ForbiddenException('Platform admin access required');

    request.platformAdminEmail = admin.email;
    return true;
  }
}
