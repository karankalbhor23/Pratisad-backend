import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformAdminGuard } from './platform-admin.guard';

jest.mock('@clerk/backend', () => ({
  verifyToken: jest.fn(),
}));

describe('PlatformAdminGuard', () => {
  const prisma = {
    platformAdmin: { findFirst: jest.fn() },
  };
  const config = { get: jest.fn() };
  const guard = new PlatformAdminGuard(
    config as unknown as ConfigService,
    prisma as unknown as PrismaService,
  );

  const context = (authorization?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization },
        }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.resetAllMocks();
    config.get = jest.fn((key: string) => {
      if (key === 'E2E_AUTH_BYPASS') return 'false';
      if (key === 'CLERK_SECRET_KEY') return 'test-secret';
      return undefined;
    });
  });

  it('allows requests when E2E_AUTH_BYPASS is true outside production', async () => {
    config.get = jest.fn((key: string) => {
      if (key === 'E2E_AUTH_BYPASS') return 'true';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    });
    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('ignores E2E_AUTH_BYPASS in production', async () => {
    config.get = jest.fn((key: string) => {
      if (key === 'E2E_AUTH_BYPASS') return 'true';
      if (key === 'NODE_ENV') return 'production';
      if (key === 'CLERK_SECRET_KEY') return 'test-secret';
      return undefined;
    });
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects missing authorization header', async () => {
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects invalid tokens', async () => {
    (verifyToken as jest.Mock).mockRejectedValue(new Error('invalid'));
    await expect(
      guard.canActivate(context('Bearer bad-token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects users not in platform_admins', async () => {
    (verifyToken as jest.Mock).mockResolvedValue({ email: 'other@example.com' });
    prisma.platformAdmin.findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      guard.canActivate(context('Bearer good-token')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows allowlisted platform admins', async () => {
    (verifyToken as jest.Mock).mockResolvedValue({
      email: 'admin@example.com',
    });
    prisma.platformAdmin.findFirst = jest.fn().mockResolvedValue({
      email: 'admin@example.com',
      isActive: true,
    });
    await expect(
      guard.canActivate(context('Bearer good-token')),
    ).resolves.toBe(true);
  });
});
