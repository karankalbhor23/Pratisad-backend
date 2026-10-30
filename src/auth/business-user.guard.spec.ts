import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { BusinessUserGuard } from './business-user.guard';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('BusinessUserGuard', () => {
  const prisma = {
    businessMember: { findFirst: jest.fn(), findMany: jest.fn() },
  };
  const clerkAuth = { canActivate: jest.fn() };
  const guard = new BusinessUserGuard(
    clerkAuth as unknown as ClerkAuthGuard,
    prisma as unknown as PrismaService,
  );

  const context = (request: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.resetAllMocks();
    clerkAuth.canActivate = jest.fn().mockResolvedValue(true);
  });

  it('allows active members matched by username', async () => {
    prisma.businessMember.findFirst = jest.fn().mockResolvedValue(null);
    prisma.businessMember.findMany = jest.fn().mockResolvedValue([
      {
        businessId: 'biz-1',
        username: 'owner1',
      },
    ]);
    const request = { clerkUsername: 'owner1' };
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request).toHaveProperty('businessId', 'biz-1');
  });

  it('rejects when no member matches', async () => {
    prisma.businessMember.findFirst = jest.fn().mockResolvedValue(null);
    prisma.businessMember.findMany = jest.fn().mockResolvedValue([]);
    await expect(
      guard.canActivate(context({ clerkUsername: 'unknown' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails closed when mutable fallback claims match multiple members', async () => {
    prisma.businessMember.findFirst = jest.fn().mockResolvedValue(null);
    prisma.businessMember.findMany = jest
      .fn()
      .mockResolvedValue([{ businessId: 'biz-1' }, { businessId: 'biz-2' }]);
    await expect(
      guard.canActivate(context({ clerkEmail: 'shared@example.com' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
