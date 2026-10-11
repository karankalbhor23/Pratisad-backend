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

    const orConditions: Array<Record<string, string>> = [];
    if (input.clerkUserId) orConditions.push({ clerkUserId: input.clerkUserId });
    if (normalizedUsername) orConditions.push({ username: normalizedUsername });
    if (normalizedEmail) orConditions.push({ email: normalizedEmail });

    const member = orConditions.length
      ? await this.prisma.businessMember.findFirst({
          where: {
            status: BusinessMemberStatus.active,
            OR: orConditions,
          },
          include: { business: { select: { name: true } } },
        })
      : null;

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
