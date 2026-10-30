import { ForbiddenException, Injectable } from '@nestjs/common';
import { BusinessMemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuthMeResponse =
  | {
      role: 'platform_admin';
      email: string;
      isPlatformAdmin: true;
    }
  | {
      role: 'business_user';
      username: string;
      businessId: string;
      businessName: string;
    };

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveMe(input: {
    email?: string;
    username?: string;
    clerkUserId?: string;
  }): Promise<AuthMeResponse> {
    const normalizedEmail = input.email?.toLowerCase();
    const normalizedUsername = input.username?.toLowerCase();

    if (normalizedEmail) {
      const admin = await this.prisma.platformAdmin.findFirst({
        where: { email: normalizedEmail, isActive: true },
      });
      if (admin) {
        return {
          role: 'platform_admin',
          email: admin.email,
          isPlatformAdmin: true,
        };
      }
    }

    const memberByClerkId = input.clerkUserId
      ? await this.prisma.businessMember.findFirst({
          where: {
            clerkUserId: input.clerkUserId,
            status: BusinessMemberStatus.active,
          },
          include: { business: { select: { name: true } } },
        })
      : null;
    const fallbackConditions: Array<Record<string, string>> = [];
    if (normalizedUsername)
      fallbackConditions.push({ username: normalizedUsername });
    if (normalizedEmail) fallbackConditions.push({ email: normalizedEmail });
    const fallbackMembers =
      !memberByClerkId && fallbackConditions.length
        ? await this.prisma.businessMember.findMany({
            where: {
              clerkUserId: null,
              status: BusinessMemberStatus.active,
              OR: fallbackConditions,
            },
            include: { business: { select: { name: true } } },
            take: 2,
          })
        : [];
    const member =
      memberByClerkId ??
      (fallbackMembers.length === 1 ? fallbackMembers[0] : null);

    if (member) {
      return {
        role: 'business_user',
        username: member.username,
        businessId: member.businessId,
        businessName: member.business.name,
      };
    }

    throw new ForbiddenException('Access denied');
  }
}
