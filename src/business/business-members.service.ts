import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { BusinessMemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertPortalPassword,
  normalizePortalUsername,
} from './portal-username.util';

export type PortalUserStatusDto = {
  username: string | null;
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
        username: null,
        status: 'none',
        invitedAt: null,
        acceptedAt: null,
      };
    }
    return this.toStatusDto(member);
  }

  async provisionPortalUser(
    businessId: string,
    username: string,
    password: string,
  ): Promise<PortalUserStatusDto> {
    await this.assertBusinessExists(businessId);
    const normalizedUsername = normalizePortalUsername(username);
    assertPortalPassword(password);

    const existingUsername = await this.prisma.businessMember.findUnique({
      where: { username: normalizedUsername },
    });
    if (existingUsername && existingUsername.businessId !== businessId) {
      throw new ConflictException('This portal username is already in use.');
    }

    const clerkUserId = await this.createClerkPortalUser(
      normalizedUsername,
      password,
      businessId,
    );

    const now = new Date();
    const member = await this.prisma.businessMember.upsert({
      where: { businessId },
      create: {
        businessId,
        username: normalizedUsername,
        clerkUserId,
        status: BusinessMemberStatus.active,
        acceptedAt: now,
      },
      update: {
        username: normalizedUsername,
        clerkUserId,
        email: null,
        status: BusinessMemberStatus.active,
        acceptedAt: now,
      },
    });

    return this.toStatusDto(member);
  }

  async resetPortalCredentials(
    businessId: string,
    password: string,
    username?: string,
  ): Promise<PortalUserStatusDto> {
    await this.assertBusinessExists(businessId);
    const member = await this.prisma.businessMember.findUnique({
      where: { businessId },
    });
    if (!member || member.status === BusinessMemberStatus.revoked) {
      throw new NotFoundException('No active portal user for this business.');
    }
    if (!member.clerkUserId) {
      throw new BadRequestException('Portal user is not linked to Clerk.');
    }

    assertPortalPassword(password);
    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      throw new BadRequestException('Portal credentials are not configured.');
    }

    let nextUsername = member.username;
    if (username !== undefined && username.trim()) {
      nextUsername = normalizePortalUsername(username);
      if (nextUsername !== member.username) {
        const taken = await this.prisma.businessMember.findUnique({
          where: { username: nextUsername },
        });
        if (taken && taken.businessId !== businessId) {
          throw new ConflictException('This portal username is already in use.');
        }
      }
    }

    const clerk = createClerkClient({ secretKey });
    try {
      await clerk.users.updateUser(member.clerkUserId, {
        password,
        ...(nextUsername !== member.username ? { username: nextUsername } : {}),
        publicMetadata: {
          role: 'business_user',
          businessId,
        },
      });
    } catch {
      throw new ConflictException(
        'Could not update portal credentials. Check username and password rules.',
      );
    }

    const updated = await this.prisma.businessMember.update({
      where: { businessId },
      data: {
        username: nextUsername,
        status: BusinessMemberStatus.active,
      },
    });

    return this.toStatusDto(updated);
  }

  async revokePortalUser(businessId: string): Promise<PortalUserStatusDto> {
    await this.assertBusinessExists(businessId);
    const existing = await this.prisma.businessMember.findUnique({
      where: { businessId },
    });
    if (!existing) {
      return {
        username: null,
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
      username: existing.username,
      status: BusinessMemberStatus.revoked,
      invitedAt: existing.invitedAt.toISOString(),
      acceptedAt: existing.acceptedAt?.toISOString() ?? null,
    };
  }

  async activateFromClerkUser(
    email: string | null,
    clerkUserId: string,
    businessIdFromMetadata?: string,
    usernameFromClerk?: string | null,
  ): Promise<void> {
    const member = await this.prisma.businessMember.findFirst({
      where: {
        status: { not: BusinessMemberStatus.revoked },
        OR: [
          { clerkUserId },
          ...(businessIdFromMetadata ? [{ businessId: businessIdFromMetadata }] : []),
          ...(email ? [{ email: email.toLowerCase() }] : []),
          ...(usernameFromClerk
            ? [{ username: usernameFromClerk.trim().toLowerCase() }]
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
        ...(email ? { email: email.toLowerCase() } : {}),
        status: BusinessMemberStatus.active,
        acceptedAt: member.acceptedAt ?? new Date(),
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

  private async createClerkPortalUser(
    username: string,
    password: string,
    businessId: string,
  ): Promise<string> {
    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      throw new BadRequestException('Portal credentials are not configured.');
    }

    const clerk = createClerkClient({ secretKey });
    try {
      const user = await clerk.users.createUser({
        username,
        password,
        publicMetadata: { role: 'business_user', businessId },
      });
      if (!user.id) {
        throw new BadRequestException('Could not create portal user in Clerk.');
      }
      return user.id;
    } catch (error: unknown) {
      const status = (error as { status?: number })?.status;
      if (status === 422 || status === 409) {
        throw new ConflictException(
          'Could not create portal user. Username may be taken or password does not meet Clerk rules.',
        );
      }
      throw new BadRequestException('Could not create portal user in Clerk.');
    }
  }

  private toStatusDto(member: {
    username: string;
    status: BusinessMemberStatus;
    invitedAt: Date;
    acceptedAt: Date | null;
  }): PortalUserStatusDto {
    return {
      username: member.username,
      status: member.status,
      invitedAt: member.invitedAt.toISOString(),
      acceptedAt: member.acceptedAt?.toISOString() ?? null,
    };
  }

  private async assertBusinessExists(businessId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Business not found');
  }
}
