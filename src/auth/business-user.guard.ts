import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { BusinessMemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkAuthedRequest } from './authed-request.types';
import { ClerkAuthGuard } from './clerk-auth.guard';

@Injectable()
export class BusinessUserGuard implements CanActivate {
  constructor(
    private readonly clerkAuth: ClerkAuthGuard,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const clerkOk = await this.clerkAuth.canActivate(context);
    if (!clerkOk) return false;

    const request = context.switchToHttp().getRequest<ClerkAuthedRequest>();
    const email = request.clerkEmail;
    const clerkUserId = request.clerkUserId;
    if (!email) throw new ForbiddenException('Business portal access required');

    const member = await this.prisma.businessMember.findFirst({
      where: {
        status: BusinessMemberStatus.active,
        OR: [
          { email: email.toLowerCase() },
          ...(clerkUserId ? [{ clerkUserId }] : []),
        ],
      },
    });

    if (!member) throw new ForbiddenException('Business portal access required');

    request.businessId = member.businessId;
    return true;
  }
}
