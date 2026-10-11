import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BusinessMembersService } from './business-members.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    users: {
      createUser: jest.fn().mockResolvedValue({ id: 'clerk_user_1' }),
      updateUser: jest.fn(),
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

  it('throws when business does not exist', async () => {
    mockPrisma.business.findUnique.mockResolvedValue(null);
    await expect(
      service.provisionPortalUser('missing', 'owner1', 'password123'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when username is taken by another business', async () => {
    mockPrisma.business.findUnique.mockResolvedValue({ id: 'biz-1' });
    mockPrisma.businessMember.findUnique.mockResolvedValue({
      businessId: 'other-biz',
      username: 'owner1',
    });

    await expect(
      service.provisionPortalUser('biz-1', 'owner1', 'password123'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
