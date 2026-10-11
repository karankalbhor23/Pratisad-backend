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
      email: string;
      businessId: string;
      businessName: string;
    };

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveMe(email: string, clerkUserId?: string): Promise<AuthMeResponse> {
    const normalized = email.toLowerCase();

    const admin = await this.prisma.platformAdmin.findFirst({
      where: { email: normalized, isActive: true },
    });
    if (admin) {
      return {
        role: 'platform_admin',
        email: admin.email,
        isPlatformAdmin: true,
      };
    }

    const member = await this.prisma.businessMember.findFirst({
      where: {
        status: BusinessMemberStatus.active,
        OR: [
          { email: normalized },
          ...(clerkUserId ? [{ clerkUserId }] : []),
        ],
      },
      include: { business: { select: { name: true } } },
    });
    if (member) {
      return {
        role: 'business_user',
        email: member.email,
        businessId: member.businessId,
        businessName: member.business.name,
      };
    }

    throw new ForbiddenException('Access denied');
  }
}
