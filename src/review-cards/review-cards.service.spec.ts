import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ReviewCardStatus } from '@prisma/client';
import { ReviewCardsService } from './review-cards.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReviewCardsService', () => {
  let service: ReviewCardsService;

  const mockPrisma = {
    reviewCardBatch: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    reviewCard: {
      createMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    business: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewCardsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'WEB_APP_ORIGIN' ? 'http://localhost:3000' : undefined,
          },
        },
      ],
    }).compile();

    service = module.get(ReviewCardsService);
  });

  it('rejects invalid batch quantity', async () => {
    await expect(service.createBatch('batch', 0)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('resolves not_found for invalid token format', async () => {
    const result = await service.resolveToken('!!');
    expect(result).toEqual({ outcome: 'not_found' });
  });

  it('resolves unassigned card', async () => {
    mockPrisma.reviewCard.findUnique.mockResolvedValue({
      status: ReviewCardStatus.unassigned,
      business: null,
    });
    const result = await service.resolveToken('abcd123456');
    expect(result).toEqual({ outcome: 'unassigned' });
  });

  it('resolves redirect for active business', async () => {
    mockPrisma.reviewCard.findUnique.mockResolvedValue({
      id: 'card-1',
      status: ReviewCardStatus.assigned,
      business: { slug: 'test-shop', isActive: true },
    });
    mockPrisma.reviewCard.update.mockResolvedValue({});
    const result = await service.resolveToken('abcd123456');
    expect(result).toEqual({ outcome: 'redirect', slug: 'test-shop' });
  });

  it('assigns a revoked card to a business', async () => {
    mockPrisma.business.findUnique.mockResolvedValue({ id: 'biz-1' });
    mockPrisma.reviewCard.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.reviewCard.findMany.mockResolvedValue([]);

    const result = await service.assignToBusiness('biz-1', {
      tokens: ['prucalitee'],
    });

    expect(mockPrisma.reviewCard.updateMany).toHaveBeenCalledWith({
      where: {
        token: 'prucalitee',
        status: { in: [ReviewCardStatus.unassigned, ReviewCardStatus.revoked] },
      },
      data: expect.objectContaining({
        status: ReviewCardStatus.assigned,
        businessId: 'biz-1',
        revokedAt: null,
      }),
    });
    expect(result.assignedTokens).toEqual(['prucalitee']);
    expect(result.errors).toEqual([]);
  });

  it('neutralizes spreadsheet formulas in CSV batch labels', async () => {
    mockPrisma.reviewCardBatch.findUnique.mockResolvedValue({
      id: 'batch-1',
      label: '=HYPERLINK("https://example.test")',
    });
    mockPrisma.reviewCard.findMany.mockResolvedValue([
      { serialInBatch: 1, token: 'abcd123456' },
    ]);
    await expect(service.buildCsvExport('batch-1')).resolves.toContain(
      '\'=HYPERLINK(""https://example.test"")',
    );
  });
});
