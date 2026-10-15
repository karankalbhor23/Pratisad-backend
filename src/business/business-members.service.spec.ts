import { ClerkAPIResponseError } from '@clerk/backend/errors';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BusinessMembersService } from './business-members.service';
import { PrismaService } from '../prisma/prisma.service';

const deleteUser = jest.fn().mockResolvedValue(undefined);
const createUser = jest.fn().mockResolvedValue({ id: 'clerk_user_1' });

jest.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    users: {
      createUser,
      updateUser: jest.fn(),
      deleteUser,
    },
  }),
}));

describe('BusinessMembersService', () => {
  let service: BusinessMembersService;

  const mockPrisma = {
    business: { findUnique: jest.fn() },
    businessMember: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessMembersService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('sk_test') },
        },
      ],
    }).compile();

    service = module.get(BusinessMembersService);
  });

  const portalPassword = 'Password1!';

  it('throws when business does not exist', async () => {
    mockPrisma.business.findUnique.mockResolvedValue(null);
    await expect(
      service.provisionPortalUser('missing', 'owner1', portalPassword),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when username is taken by another business', async () => {
    mockPrisma.business.findUnique.mockResolvedValue({ id: 'biz-1' });
    mockPrisma.businessMember.findUnique.mockResolvedValue({
      businessId: 'other-biz',
      username: 'owner1',
    });

    await expect(
      service.provisionPortalUser('biz-1', 'owner1', portalPassword),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('surfaces Clerk validation errors when user creation fails', async () => {
    mockPrisma.business.findUnique.mockResolvedValue({ id: 'biz-1' });
    mockPrisma.businessMember.findUnique.mockResolvedValue(null);
    createUser.mockRejectedValueOnce(
      new ClerkAPIResponseError('Unprocessable Entity', {
        status: 422,
        data: [
          {
            code: 'form_password_pwned',
            message: 'Password has been found in an online data breach.',
            long_message:
              'This password has been found in an online data breach.',
          },
        ],
      }),
    );

    await expect(
      service.provisionPortalUser('biz-1', 'owner1', portalPassword),
    ).rejects.toMatchObject({
      response: { message: expect.stringContaining('data breach') },
    });
  });

  it('deletes the Clerk user when database provisioning fails', async () => {
    mockPrisma.business.findUnique.mockResolvedValue({ id: 'biz-1' });
    mockPrisma.businessMember.findUnique.mockResolvedValue(null);
    createUser.mockResolvedValueOnce({ id: 'clerk_user_2' });
    mockPrisma.businessMember.upsert.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    await expect(
      service.provisionPortalUser('biz-1', 'owner2', portalPassword),
    ).rejects.toThrow('database unavailable');

    expect(deleteUser).toHaveBeenCalledWith('clerk_user_2');
  });
});
