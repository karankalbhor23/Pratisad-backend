import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';

describe('PlatformAdminGuard', () => {
  const prisma = {
    platformAdmin: { findFirst: jest.fn() },
  };
  const clerkAuth = { canActivate: jest.fn() };
  const guard = new PlatformAdminGuard(
    clerkAuth as unknown as ClerkAuthGuard,
    prisma as unknown as PrismaService,
  );

  const context = (): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.resetAllMocks();
    clerkAuth.canActivate = jest.fn().mockResolvedValue(true);
  });

  it('rejects when clerk auth fails', async () => {
    clerkAuth.canActivate = jest.fn().mockResolvedValue(false);
    await expect(guard.canActivate(context())).resolves.toBe(false);
  });

  it('rejects users not in platform_admins', async () => {
    const request = { clerkEmail: 'other@example.com' };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    prisma.platformAdmin.findFirst = jest.fn().mockResolvedValue(null);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows allowlisted platform admins', async () => {
    const request = { clerkEmail: 'admin@example.com' };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    prisma.platformAdmin.findFirst = jest.fn().mockResolvedValue({
      email: 'admin@example.com',
      isActive: true,
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request).toHaveProperty('platformAdminEmail', 'admin@example.com');
  });
});
