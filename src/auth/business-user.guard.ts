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

    const request = asClerkAuthedRequest(
      context.switchToHttp().getRequest(),
    );
    const email = request.clerkEmail?.toLowerCase();
    const clerkUserId = request.clerkUserId;
    const username = request.clerkUsername;

    const orConditions: Array<Record<string, string>> = [];
    if (clerkUserId) orConditions.push({ clerkUserId });
    if (username) orConditions.push({ username });
    if (email) orConditions.push({ email });

    if (!orConditions.length) {
      throw new ForbiddenException('Business portal access required');
    }

    const member = await this.prisma.businessMember.findFirst({
      where: {
        status: BusinessMemberStatus.active,
        OR: orConditions,
      },
    });

    if (!member) throw new ForbiddenException('Business portal access required');

    request.businessId = member.businessId;
    return true;
  }
}
