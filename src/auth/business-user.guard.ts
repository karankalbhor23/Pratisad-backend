import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { BusinessMemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { asClerkAuthedRequest } from './authed-request.types';
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

    const request = asClerkAuthedRequest(context.switchToHttp().getRequest());
    const email = request.clerkEmail?.toLowerCase();
    const clerkUserId = request.clerkUserId;
    const username = request.clerkUsername;

    if (!clerkUserId && !username && !email) {
      throw new ForbiddenException('Business portal access required');
    }

    const memberByClerkId = clerkUserId
      ? await this.prisma.businessMember.findFirst({
          where: { clerkUserId, status: BusinessMemberStatus.active },
        })
      : null;
    if (memberByClerkId) {
      request.businessId = memberByClerkId.businessId;
      return true;
    }

    // Username/email are migration-only fallbacks. Never let a mutable claim
    // select an already-bound membership, and fail closed when it is ambiguous.
    const fallbackConditions: Array<Record<string, string>> = [];
    if (username) fallbackConditions.push({ username });
    if (email) fallbackConditions.push({ email });
    const members = fallbackConditions.length
      ? await this.prisma.businessMember.findMany({
          where: {
            clerkUserId: null,
            status: BusinessMemberStatus.active,
            OR: fallbackConditions,
          },
          take: 2,
        })
      : [];
    const member = members.length === 1 ? members[0] : null;

    if (!member)
      throw new ForbiddenException('Business portal access required');

    request.businessId = member.businessId;
    return true;
  }
}
