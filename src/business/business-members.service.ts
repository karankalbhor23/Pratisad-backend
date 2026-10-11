import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { BusinessMemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PortalUserStatusDto = {
  email: string | null;
  status: 'none' | BusinessMemberStatus;
  invitedAt: string | null;
  acceptedAt: string | null;
};

@Injectable()
export class BusinessMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getPortalUser(businessId: string): Promise<PortalUserStatusDto> {
    await this.assertBusinessExists(businessId);
    const member = await this.prisma.businessMember.findUnique({
      where: { businessId },
    });
    if (!member || member.status === BusinessMemberStatus.revoked) {
      return {
        email: null,
        status: 'none',
        invitedAt: null,
        acceptedAt: null,
      };
    }
    return {
      email: member.email,
      status: member.status,
      invitedAt: member.invitedAt.toISOString(),
      acceptedAt: member.acceptedAt?.toISOString() ?? null,
    };
  }

  async invitePortalUser(businessId: string, email: string): Promise<PortalUserStatusDto> {
    await this.assertBusinessExists(businessId);
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      throw new BadRequestException('A valid email is required.');
    }

    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    const webOrigin = this.config.get<string>('WEB_APP_ORIGIN');
    if (!secretKey || !webOrigin) {
      throw new BadRequestException(
        'Portal invitations are not configured on the server.',
      );
    }

    const clerk = createClerkClient({ secretKey });
    await clerk.invitations.createInvitation({
      emailAddress: normalized,
      redirectUrl: `${webOrigin.replace(/\/+$/, '')}/portal`,
      publicMetadata: { role: 'business_user', businessId },
      ignoreExisting: true,
    });

    const member = await this.prisma.businessMember.upsert({
      where: { businessId },
      create: {
        businessId,
        email: normalized,
        status: BusinessMemberStatus.invited,
      },
      update: {
        email: normalized,
        status: BusinessMemberStatus.invited,
        invitedAt: new Date(),
        acceptedAt: null,
        clerkUserId: null,
      },
    });

    return {
      email: member.email,
      status: member.status,
      invitedAt: member.invitedAt.toISOString(),
      acceptedAt: member.acceptedAt?.toISOString() ?? null,
    };
  }

  async revokePortalUser(businessId: string): Promise<PortalUserStatusDto> {
    await this.assertBusinessExists(businessId);
    const existing = await this.prisma.businessMember.findUnique({
      where: { businessId },
    });
    if (!existing) {
      return {
        email: null,
        status: 'none',
        invitedAt: null,
        acceptedAt: null,
      };
    }
    await this.prisma.businessMember.update({
      where: { businessId },
      data: { status: BusinessMemberStatus.revoked },
    });
    return {
      email: existing.email,
      status: BusinessMemberStatus.revoked,
      invitedAt: existing.invitedAt.toISOString(),
      acceptedAt: existing.acceptedAt?.toISOString() ?? null,
    };
  }

  async activateFromClerkUser(
    email: string,
    clerkUserId: string,
    businessIdFromMetadata?: string,
  ): Promise<void> {
    const normalized = email.toLowerCase();
    const member = await this.prisma.businessMember.findFirst({
      where: {
        OR: [
          { email: normalized, status: BusinessMemberStatus.invited },
          ...(businessIdFromMetadata
            ? [{ businessId: businessIdFromMetadata }]
            : []),
        ],
      },
      orderBy: { invitedAt: 'desc' },
    });
    if (!member || member.status === BusinessMemberStatus.revoked) return;

    await this.prisma.businessMember.update({
      where: { id: member.id },
      data: {
        clerkUserId,
        email: normalized,
        status: BusinessMemberStatus.active,
        acceptedAt: new Date(),
      },
    });

    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    if (secretKey) {
      const clerk = createClerkClient({ secretKey });
      try {
        await clerk.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            role: 'business_user',
            businessId: member.businessId,
          },
        });
      } catch {
        // Non-fatal if metadata update fails; DB membership is source of truth.
      }
    }
  }

  private async assertBusinessExists(businessId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Business not found');
  }
}
